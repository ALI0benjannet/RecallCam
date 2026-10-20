import Link from "next/link";
import { ArrowUpRight, Camera, FileVideo, FileClock, Search } from "lucide-react";
import { PageHeading } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EvidenceGraphic } from "@/components/evidence-graphic";
export default function LibraryPage() {
  return (
    <>
      <PageHeading
        title="Recording library"
        description="Your shared archive, organized by camera and original recording time."
        action={
          <Badge variant="outline" className="bg-card px-3 py-1.5 text-muted-foreground">
            Not connected yet
          </Badge>
        }
      />
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">All your footage, in context</h2>
            <p className="panel-description">One place to browse recordings across cameras</p>
          </div>
          <FileVideo className="size-5 text-primary" strokeWidth={1.5} />
        </div>
        <div className="grid items-center gap-6 p-7 sm:p-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <h3 className="max-w-sm text-[28px] font-semibold leading-tight tracking-[-0.03em]">
              An archive you can
              <br className="hidden sm:block" /> find your way through.
            </h3>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
              The library will bring camera context, original timelines and indexing status
              together. Browsing recordings will be available when storage and uploads are
              connected.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/cameras">
                Explore camera directory
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="rounded-xl bg-muted/70 p-4 sm:p-6">
            <EvidenceGraphic className="mx-auto max-w-sm" />
          </div>
        </div>
        <div className="grid divide-y border-t bg-muted/25 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            {
              icon: Camera,
              title: "Camera context",
              text: "Find footage by its source and location.",
            },
            {
              icon: FileClock,
              title: "Original timeline",
              text: "Browse by when a recording was captured.",
            },
            {
              icon: Search,
              title: "Indexing status",
              text: "See which recordings are ready to investigate.",
            },
          ].map((item) => (
            <div className="p-6" key={item.title}>
              <item.icon className="mb-3 size-[18px] text-primary" strokeWidth={1.5} />
              <h3 className="text-xs font-semibold">{item.title}</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        This page does not list or process recordings yet.
      </p>
    </>
  );
}
