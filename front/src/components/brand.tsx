import Image from "next/image";
import { cn } from "@/lib/utils";
export function Brand({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl",
          light ? "bg-sage" : "bg-sage/80",
        )}
      >
        <Image
          src="/brand/recallcam-mark-v2.png"
          alt=""
          width={38}
          height={38}
          className="size-[38px] object-contain"
          priority
        />
      </span>
      <span className={cn("text-left", light ? "text-sidebar-foreground" : "text-foreground")}>
        <span className="block text-[21px] font-bold leading-6 tracking-[-0.035em]">
          RecallCam<span className={light ? "text-highlight" : "text-primary"}>.</span>
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-1 block text-[10px] font-medium tracking-wide",
              light ? "text-sidebar-muted" : "text-muted-foreground",
            )}
          >
            Video intelligence workspace
          </span>
        )}
      </span>
    </span>
  );
}
