"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FAQ_ITEMS } from "@/lib/data/faqContent";
import { useState } from "react";

export default function FAQPage() {
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
                            onOpenChange={(isOpen) =>
                                setOpenId(isOpen ? item.id : null)
                            }
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
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                    />
                                </svg>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-4 py-4 bg-card/50 border border-t-0 border-border rounded-b-lg text-sm text-foreground/80 whitespace-pre-wrap space-y-3">
                                {typeof item.content === "string" ? (
                                    <div className="leading-relaxed">
                                        {item.content}
                                    </div>
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
