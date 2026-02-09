# Manual Completion Steps

Due to tool limitations, some steps require manual completion. Follow these steps:

## 🎯 FAQ Page Setup (Task 2.2)

### Step 1: Create FAQ directory
```cmd
mkdir apps\web\app\faq
```

### Step 2: Create FAQ page file

Create `apps/web/app/faq/page.tsx` with the complete code from `doc/insecurity-metrics-task2.2-faq-page.md` (Section 2).

### Step 3: Install collapsible dependency
```bash
pnpm install
```

### Step 4: Validate
```bash
pnpm typecheck
pnpm lint:eslint
```

### Step 5: Test
```bash
pnpm dev
# Visit http://localhost:3000/faq
```

---

## 📋 Legacy Steps (TileServer Implementation - Ignore)

(Previous TileServer setup steps - not relevant to current task)
