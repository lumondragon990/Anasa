#!/usr/bin/env bash
# TEST 11 — concurrency. 40 parallel sessions create quotations for the same
# customer while 10 parallel sessions try to convert the same accepted quote.
# Expect: 40 distinct, gap-free numbers and exactly one sales order.
set -euo pipefail
URL="$1"
ADMIN="00000000-0000-0000-0000-00000000000a"
CUST=$(psql "$URL" -Atc "select id from t.ctx where key='glp'")
Q=$(psql "$URL" -Atc "select id from public.quotations where customer_id='$CUST' and title='Sales rep quote'")

psql "$URL" -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
set role authenticated;
select set_config('request.jwt.claim.sub', '$ADMIN', false);
insert into public.quotation_line_items (revision_id, line_no, description, quantity, unit_price)
  select current_revision_id, 1, 'Concurrency item', 1, 10 from public.quotations where id = '$Q';
select public.approve_quotation_revision((select current_revision_id from public.quotations where id = '$Q'));
select public.accept_quotation('$Q', (select current_revision_id from public.quotations where id = '$Q'));
insert into public.customer_purchase_orders (customer_id, po_number) values ('$CUST', 'GLP-CONC-1');
SQL
BEFORE=$(psql "$URL" -Atc "select count(*) from public.quotations where customer_id='$CUST'")
PO=$(psql "$URL" -Atc "select id from public.customer_purchase_orders where po_number='GLP-CONC-1'")

pids=()
for i in $(seq 1 40); do
  psql "$URL" -q -v ON_ERROR_STOP=1 -c "set role authenticated; select set_config('request.jwt.claim.sub','$ADMIN',false); select public.create_quotation('$CUST','Concurrent $i');" >/dev/null &
  pids+=($!)
done
for i in $(seq 1 10); do
  psql "$URL" -q -v ON_ERROR_STOP=1 -c "set role authenticated; select set_config('request.jwt.claim.sub','$ADMIN',false); select public.convert_quotation_to_order('$Q','$PO','conc-$i');" >/dev/null &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done

read -r TOTAL DISTINCT MAXSEQ <<<"$(psql "$URL" -AtF' ' -c "select count(*), count(distinct quote_number), max(sequence) from public.quotations where customer_id='$CUST'")"
ORDERS=$(psql "$URL" -Atc "select count(*) from public.sales_orders where source_quotation_id='$Q'")
EXPECTED=$((BEFORE + 40))
[[ "$TOTAL" == "$EXPECTED" && "$DISTINCT" == "$EXPECTED" && "$MAXSEQ" == "$EXPECTED" ]] \
  || { echo "FAIL: quotes total=$TOTAL distinct=$DISTINCT max=$MAXSEQ expected=$EXPECTED"; exit 1; }
[[ "$ORDERS" == "1" ]] || { echo "FAIL: $ORDERS sales orders created for one quotation"; exit 1; }
echo "TEST 11 passed: $EXPECTED unique gap-free quote numbers, 1 conversion from 10 concurrent attempts"
