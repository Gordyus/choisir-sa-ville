# Manual Completion Steps for FAQ Page Implementation

Due to tool limitations (cannot create directories), the following manual steps are required:

## Step 1: Create directory structure

### On Windows:
```cmd
mkdir apps\web\app\faq
```

### On Linux/Mac:
```bash
mkdir -p apps/web/app/faq
```

## Step 2: Create the FAQ page file

Create `apps/web/app/faq/page.tsx` with the following content:

```typescript
"use client";

import { useState } from "react";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import { FAQ_ITEMS } from "@/lib/data/faqContent";

export default function FAQPage(): JSX.Element {
    const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

    return (
        <div className="min-h-screen bg-background py-12 px-4">
            <div className="mx-auto max-w-2xl">
                <h1 className="text-4xl font-bold mb-2 text-foreground">
                    Questions fréquentes
                </h1>
                <p className="text-lg text-muted-foreground mb-8">
                    Tout ce que vous devez savoir sur le classement des communes par insécurité.
                </p>

                <div className="space-y-2">
                    {FAQ_ITEMS.map((item) => (
                        <Collapsible
                            key={item.id}
                            open={openId === item.id}
                            onOpenChange={(isOpen) => setOpenId(isOpen ? item.id : null)}
                        >
                            <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg hover:bg-card/80 transition-colors text-left font-semibold text-foreground">
                                {item.title}
                                <svg
                                    className={`h-5 w-5 transition-transform ${
                                        openId === item.id ? "rotate-180" : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                    />
                                </svg>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-4 py-3 bg-card/50 border border-t-0 border-border rounded-b-lg text-sm text-foreground/80 prose prose-sm dark:prose-invert">
                                {typeof item.content === "string" ? (
                                    <div className="whitespace-pre-wrap">{item.content}</div>
                                ) : (
                                    item.content
                                )}
                            </CollapsibleContent>
                        </Collapsible>
                    ))}
                </div>
            </div>
        </div>
    );
}
```

## Step 3: Install dependencies

```bash
pnpm install
```

This will install the new dependency `@radix-ui/react-collapsible` that was added to package.json.

## Step 4: Run validation

```bash
pnpm typecheck
pnpm lint:eslint
```

Both commands should complete with 0 errors/warnings.

## Step 5: Test the implementation

```bash
pnpm dev
```

Then visit http://localhost:3000/faq to verify:
1. The page loads correctly
2. Accordions open/close smoothly
3. Only one accordion can be open at a time (mono-open behavior)
4. Content is properly formatted with the markdown-style text
5. FAQ content is auto-generated from the insecurity metrics config

## Troubleshooting

### TypeScript errors
- Ensure the page.tsx file was created with the exact content above
- Run `pnpm install` to install the new dependency
- Restart your IDE/editor to pick up the new types

### Import errors
- Verify that `apps/web/lib/data/faqContent.ts` exists (should have been created automatically)
- Verify that `apps/web/components/ui/collapsible.tsx` exists (should have been created automatically)
- Check that all paths use the `@/` alias correctly

### Styling issues
- The page uses Tailwind CSS classes including `prose` for markdown-style formatting
- Ensure your tailwind.config.ts includes the typography plugin if prose styles don't work
