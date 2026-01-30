# Schéma DB (wireframe)

Source de vérité : `packages/db/migrations/001_squashed.sql`.

## Diagramme (relations)

```text
commune (pivot)
  +--< infra_zone.parentCommuneCode     (ON DELETE CASCADE)
  +--< commune_postal_code.communeCode  (ON DELETE CASCADE)

city (VIEW) = SELECT * FROM commune
```

Hiérarchie (FK au MVP) :
- `department.regionCode` → `region.code`
- `commune.departmentCode` → `department.code`
- `commune.regionCode` → `region.code`

---

## Tables

### `commune`

```text
+-----------------------------------------------------+
| commune                                              |
+-----------------------------------------------------+
| PK  inseeCode          varchar(5)                    |
|     name               text        NOT NULL          |
|     population         integer                       |
| FK  departmentCode     varchar(3)                    |
| FK  regionCode         varchar(3)                    |
|     lat                double precision              |
|     lon                double precision              |
| UQ  slug               text        NOT NULL          |
|     createdAt          timestamptz NOT NULL          |
|     updatedAt          timestamptz NOT NULL          |
+-----------------------------------------------------+
Indexes:
  - commune_name_idx (name)
  - commune_department_code_idx (departmentCode)
  - commune_region_code_idx (regionCode)
  - commune_slug_idx UNIQUE (slug)
FKs:
  - commune.departmentCode -> department.code
  - commune.regionCode -> region.code
```

### `infra_zone`

```text
+-----------------------------------------------------+
| infra_zone                                           |
+-----------------------------------------------------+
| PK  id                 text                          |
|     type               text        NOT NULL           |
|     code               varchar(5)  NOT NULL           |
| FK  parentCommuneCode  varchar(5)  NOT NULL           |
|     name               text        NOT NULL           |
| UQ  slug               text        NOT NULL           |
|     createdAt          timestamptz NOT NULL           |
|     updatedAt          timestamptz NOT NULL           |
| CK  infra_zone_type_check: type IN ('ARM','COMD','COMA') |
+-----------------------------------------------------+
Indexes:
  - infra_zone_parent_idx (parentCommuneCode)
  - infra_zone_type_code_idx UNIQUE (type, code)
  - infra_zone_slug_idx UNIQUE (slug)
FKs:
  - infra_zone.parentCommuneCode -> commune.inseeCode (ON DELETE CASCADE)
```

### `region`

```text
+---------------------------------------------------+
| region                                             |
+---------------------------------------------------+
| PK  code               varchar(3)                  |
|     name               text        NOT NULL        |
|     createdAt          timestamptz NOT NULL        |
|     updatedAt          timestamptz NOT NULL        |
+---------------------------------------------------+
```

### `department`

```text
+---------------------------------------------------+
| department                                         |
+---------------------------------------------------+
| PK  code               varchar(3)                  |
|     name               text        NOT NULL        |
| FK  regionCode         varchar(3)                  |
|     createdAt          timestamptz NOT NULL        |
|     updatedAt          timestamptz NOT NULL        |
+---------------------------------------------------+
Indexes:
  - department_region_code_idx (regionCode)
FKs:
  - department.regionCode -> region.code
```

### `commune_postal_code`

```text
+-----------------------------------------------------+
| commune_postal_code                                  |
+-----------------------------------------------------+
| PK  communeCode         varchar(5)  NOT NULL          |
| PK  postalCode          varchar(10) NOT NULL          |
+-----------------------------------------------------+
Indexes:
  - commune_postal_code_postal_idx (postalCode)
FKs:
  - commune_postal_code.communeCode -> commune.inseeCode (ON DELETE CASCADE)
```

### `cache_store`

```text
+---------------------------------------------------+
| cache_store                                        |
+---------------------------------------------------+
| PK  key                text                        |
|     value              jsonb       NOT NULL        |
|     expiresAt          timestamptz NOT NULL        |
|     createdAt          timestamptz NOT NULL        |
|     updatedAt          timestamptz NOT NULL        |
+---------------------------------------------------+
Indexes:
  - cache_store_expires_idx (expiresAt)
```

---

## View

### `city` (compat)

```text
VIEW city AS
  SELECT * FROM commune;
```
