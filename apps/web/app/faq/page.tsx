"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FAQ_ITEMS } from "@/features/faq";
import { useState } from "react";

export default function FAQPage() {
    const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

    return (
        <div className="flex-1 overflow-y-auto px-4 py-12">
            <div className="mx-auto max-w-2xl">
                <h1 className="mb-2 text-4xl font-bold text-brand-dark">
                    Questions fréquentes
                </h1>
                <p className="mb-8 text-lg text-brand/60">
                    Tout ce que vous devez savoir sur les données et indicateurs affichés.
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
                            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-brand/15 bg-white px-4 py-3 text-left font-semibold text-brand-dark transition-colors hover:bg-brand/5">
                                {item.title}
                                <svg
                                    className={`h-5 w-5 text-brand/50 transition-transform ${
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
                            <CollapsibleContent className="space-y-3 whitespace-pre-wrap rounded-b-lg border border-t-0 border-brand/15 bg-brand/[0.02] px-4 py-4 text-sm text-brand/80">
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
