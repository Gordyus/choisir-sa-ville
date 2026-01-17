# DB Model

## Tables

### commune
Primary table for communes (COM).

Columns:
- `inseeCode` (varchar(5), PK)
- `name` (text, not null)
- `population` (int, null)
- `departmentCode` (varchar(3), null)
- `regionCode` (varchar(3), null)
- `lat` (double precision, null)
- `lon` (double precision, null)
- `createdAt` (timestamptz, not null, default now())
- `updatedAt` (timestamptz, not null, default now())

Indexes:
- `commune_name_idx` on `name`

### infra_zone
Infra-communal zones (ARM, COMD, COMA). Always attached to a parent commune.

Columns:
- `id` (text, PK) - `${type}:${code}`
- `type` (text, not null, check in `ARM|COMD|COMA`)
- `code` (varchar(5), not null)
- `parentCommuneCode` (varchar(5), not null, FK to `commune.inseeCode`)
- `name` (text, not null)
- `createdAt` (timestamptz, not null, default now())
- `updatedAt` (timestamptz, not null, default now())

Indexes:
- unique (`type`, `code`)
- index on `parentCommuneCode`

## Backward Compatibility
- A `city` view is created as `SELECT * FROM commune` to avoid breaking existing reads.

## Why Infra Zones Are Not Communes
Infra zones are subdivisions of communes (arrondissements, communes deleguees/associees).
They must never replace or flatten commune-level data. Communes remain the primary unit
for navigation, aggregation, and reporting.

## Naming in API
- The public API uses the product term "city" (see `/cities` routes).
- The data source remains administrative communes (`commune` table).
