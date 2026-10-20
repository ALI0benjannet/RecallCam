import Link from "next/link";
import { ArrowUpRight, Camera, FileClock, MessageSquare, Search, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
export default function InvestigatePage() {
  return (
    <>
      <PageHeading
        title="Investigate"
        description="Start with a question. Follow the moments that support the answer."
        action={
          <Badge variant="outline" className="bg-card px-3 py-1.5 text-muted-foreground">
            Not connected yet
          </Badge>
        }
      />
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="panel flex min-h-[480px] flex-col">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Evidence-led answers</h2>
              <p className="panel-description">
                Camera context, a question and the supporting footage
              </p>
            </div>
            <MessageSquare className="size-5 text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-6 flex items-center gap-3 text-primary">
              <span className="grid size-12 place-items-center rounded-xl border bg-muted/60">
                <Search className="size-5" strokeWidth={1.5} />
              </span>
              <span className="h-px w-8 bg-border" />
              <span className="grid size-16 place-items-center rounded-2xl bg-sage">
                <MessageSquare className="size-7" strokeWidth={1.4} />
              </span>
              <span className="h-px w-8 bg-border" />
              <span className="grid size-12 place-items-center rounded-xl border bg-muted/60">
                <FileClock className="size-5" strokeWidth={1.5} />
              </span>
            </div>
            <h3 className="max-w-md text-2xl font-semibold tracking-[-0.03em]">
              The answer should lead
              <br className="hidden sm:block" /> you back to the footage.
            </h3>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
              Question answering and timestamped evidence will be available once indexing and
              retrieval are connected.
            </p>
          </div>
          <div className="border-t p-5 sm:p-6">
            <Label
              htmlFor="investigation-preview"
              className="mb-3 block text-xs text-muted-foreground"
            >
              Questions are unavailable in this version
            </Label>
            <div className="overflow-hidden rounded-xl border bg-muted/40">
              <Textarea
                id="investigation-preview"
                disabled
                placeholder="Ask about your indexed recordings…"
                className="min-h-20 resize-none border-0 bg-transparent p-4 shadow-none disabled:opacity-70"
              />
              <div className="flex items-center justify-between gap-3 px-4 pb-3">
                <span className="text-[10px] text-muted-foreground">No question will be sent</span>
                <Button disabled size="sm">
                  <ArrowUpRight className="size-3.5" />
                  Ask
                </Button>
              </div>
            </div>
          </div>
        </section>
        <aside className="space-y-6">
          <section className="panel p-6">
            <h2 className="panel-title">An investigation needs context</h2>
            <div className="mt-6 space-y-6">
              {[
                {
                  icon: Camera,
                  title: "Select cameras",
                  text: "Choose the viewpoints relevant to your question.",
                },
                {
                  icon: FileClock,
                  title: "Set a time range",
                  text: "Search within the original recording timeline.",
                },
                {
                  icon: ShieldCheck,
                  title: "Review the evidence",
                  text: "Check the clips and timestamps behind each answer.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <item.icon
                    className="mt-0.5 size-[18px] shrink-0 text-primary"
                    strokeWidth={1.5}
                  />
                  <div>
                    <h3 className="text-xs font-semibold">{item.title}</h3>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/cameras" className="subtle-link mt-7">
              View camera directory
              <ArrowUpRight className="size-3.5" />
            </Link>
          </section>
          <p className="px-1 text-xs leading-6 text-muted-foreground">
            Answers, clip playback and feedback will be added with the investigation workflow.
          </p>
        </aside>
      </div>
    </>
  );
}
