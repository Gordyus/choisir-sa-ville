import RightPanel from "@/components/right-panel";
import OsmMap from "@/components/osm-map";

export default function HomePage(): JSX.Element {
  return (
    <section className="flex h-full w-full flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
      <div className="flex w-full flex-1 flex-col lg:w-[60%]">
        <div className="h-[320px] flex-1 rounded-3xl border border-brand/15 bg-white shadow-xl shadow-brand/5">
          <OsmMap className="min-h-[320px] rounded-3xl" />
        </div>
      </div>
      <div className="w-full lg:w-[40%]">
        <RightPanel className="h-full" />
      </div>
    </section>
  );
}
