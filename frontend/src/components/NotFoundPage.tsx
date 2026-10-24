import { PageHeader } from "@/design-system";

export function NotFoundPage() {
  return (
    <div className="pt-10">
      <PageHeader title="Tej strony nie ma" />
      <p className="m-0 max-w-[560px] text-[15px] leading-[1.7] text-[#40595c]">
        Adres jest nieznany albo projekt, do którego prowadził, został usunięty.
      </p>
    </div>
  );
}
