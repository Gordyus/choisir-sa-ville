import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sources & licences | Choisir sa ville",
    description:
        "Informations sur les sources de données et les licences utilisées par l'application Choisir sa ville."
};

export default function SourcesPage(): JSX.Element {
    return (
        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">
            <header className="space-y-2">
                <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                    Sources & licences
                </h1>
                <p className="max-w-prose text-sm text-slate-600">
                    Cette page présente les principales sources de données utilisées par l'application
                    <span className="whitespace-nowrap"> Choisir sa ville</span>, ainsi que les licences
                    associées. Les formulations ci-dessous sont destinées à rester compréhensibles pour
                    tout utilisateur, sans prérequis technique.
                </p>
            </header>

            <div className="space-y-6 divide-y divide-slate-200">
                {/* Section 1 — Fond de carte */}
                <section className="pt-0">
                    <h2 className="mb-2 text-lg font-semibold text-slate-900">
                        1. Fond de carte
                    </h2>
                    <p className="mb-2 text-sm text-slate-700">
                        Le fond de carte est fourni par OpenMapTiles, à partir des données
                        <span className="whitespace-nowrap"> © OpenStreetMap</span> contributors, sous licence
                        ODbL.
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                        <li>
                            Source&nbsp;: OpenStreetMap
                        </li>
                        <li>
                            Rendu cartographique&nbsp;: OpenMapTiles
                        </li>
                        <li>
                            Licence&nbsp;: Open Database License (ODbL)
                        </li>
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        <a
                            href="https://www.openstreetmap.org/copyright"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:text-brand-dark underline-offset-2 hover:underline"
                        >
                            openstreetmap.org/copyright
                        </a>
                        <a
                            href="https://openmaptiles.org/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:text-brand-dark underline-offset-2 hover:underline"
                        >
                            openmaptiles.org
                        </a>
                    </div>
                </section>

                {/* Section 2 — Limites administratives */}
                <section className="pt-6">
                    <h2 className="mb-2 text-lg font-semibold text-slate-900">
                        2. Limites administratives
                    </h2>
                    <p className="mb-2 text-sm text-slate-700">
                        Les limites administratives sont issues des données de l’IGN et de l’INSEE, diffusées
                        sous Licence Ouverte 2.0.
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                        <li>Source&nbsp;: IGN / INSEE</li>
                        <li>Type de données&nbsp;: limites administratives des communes et arrondissements</li>
                        <li>Licence&nbsp;: Licence Ouverte 2.0 (Etalab)</li>
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        <a
                            href="https://www.ign.fr/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:text-brand-dark underline-offset-2 hover:underline"
                        >
                            ign.fr
                        </a>
                        <a
                            href="https://www.insee.fr/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:text-brand-dark underline-offset-2 hover:underline"
                        >
                            insee.fr
                        </a>
                        <a
                            href="https://www.etalab.gouv.fr/licence-ouverte-open-licence"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:text-brand-dark underline-offset-2 hover:underline"
                        >
                            Licence Ouverte 2.0 (Etalab)
                        </a>
                    </div>
                </section>

                {/* Section 3 — Données statistiques communales */}
                <section className="pt-6">
                    <h2 className="mb-2 text-lg font-semibold text-slate-900">
                        3. Données statistiques communales
                    </h2>
                    <p className="mb-2 text-sm text-slate-700">
                        Les données statistiques (communes, populations, régions, départements) proviennent de
                        l’INSEE.
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                        <li>Communes</li>
                        <li>Populations</li>
                        <li>Régions</li>
                        <li>Départements</li>
                    </ul>
                    <p className="mt-2 text-sm text-slate-700">
                        Source&nbsp;: INSEE — données diffusées sous Licence Ouverte (Etalab).
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        <a
                            href="https://www.insee.fr/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:text-brand-dark underline-offset-2 hover:underline"
                        >
                            insee.fr
                        </a>
                        <a
                            href="https://www.etalab.gouv.fr/licence-ouverte-open-licence"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:text-brand-dark underline-offset-2 hover:underline"
                        >
                            Licence Ouverte (Etalab)
                        </a>
                    </div>
                </section>

                {/* Section 4 — Codes postaux */}
                <section className="pt-6">
                    <h2 className="mb-2 text-lg font-semibold text-slate-900">4. Codes postaux</h2>
                    <p className="mb-2 text-sm text-slate-700">
                        Les données de codes postaux sont issues de data.gouv.fr.
                    </p>
                    <p className="text-sm text-slate-700">
                        Source&nbsp;: data.gouv.fr — données diffusées sous Licence Ouverte (Etalab).
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        <a
                            href="https://www.data.gouv.fr/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:text-brand-dark underline-offset-2 hover:underline"
                        >
                            data.gouv.fr
                        </a>
                        <a
                            href="https://www.etalab.gouv.fr/licence-ouverte-open-licence"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:text-brand-dark underline-offset-2 hover:underline"
                        >
                            Licence Ouverte (Etalab)
                        </a>
                    </div>
                </section>
            </div>
        </section>
    );
}
