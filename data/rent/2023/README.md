Rent 2023 dataset

Expected CSV: data/rent/2023/rent_2023.csv

Required columns (case-insensitive):
- INSEE commune code (5 chars)
- Median rent per m2

Optional columns:
- P25, P75, Min, Max per m2

The importer attempts to match common column headers such as:
- code_insee / insee / codgeo
- rent_median / loyer_median / median
- rent_p25 / p25
- rent_p75 / p75
- rent_min / min
- rent_max / max
