import Link from "next/link";
import { ArrowRight, Camera, FileVideo, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeading } from "@/components/feedback";
export default function UploadPage() {
  return (
    <>
      <PageHeading
        title="Upload recordings"
        description="Bring footage into your archive with its camera and original recording start time."
        action={
          <Badge variant="outline" className="bg-card px-3 py-1.5 text-muted-foreground">
            Not connected yet
          </Badge>
        }
      />
      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Add a recording</h2>
              <p className="panel-description">Upload and processing are separate steps</p>
            </div>
            <Upload className="size-5 text-primary" strokeWidth={1.5} />
          </div>
          <div className="p-6 sm:p-9">
            <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-primary/25 bg-muted/40 px-6 py-10 text-center">
              <span className="mb-6 grid size-[72px] place-items-center rounded-2xl border bg-card">
                <FileVideo className="size-8 text-primary" strokeWidth={1.3} />
              </span>
              <h3 className="text-lg font-semibold tracking-tight">A place for your footage.</h3>
              <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
                Video upload is being connected. File selection and storage will become available
                here.
              </p>
              <Button disabled className="mt-6">
                <Upload className="size-4" />
                Upload unavailable
              </Button>
            </div>
          </div>
          <div className="flex items-start gap-3 border-t bg-muted/25 px-6 py-5 text-xs leading-6 text-muted-foreground">
            <Camera className="mt-1 size-4 shrink-0 text-primary" />
            <p>
              Each recording will need a camera and its original start time to keep evidence
              timestamps accurate.
            </p>
          </div>
        </section>
        <aside className="panel p-6">
          <h2 className="panel-title">How it will work</h2>
          <ol className="mt-6 space-y-7">
            {[
              { title: "Choose your recording", text: "Select a video and its source camera." },
              {
                title: "Set the original start time",
                text: "Use the recording date and camera timezone.",
              },
              {
                title: "Store, then process",
                text: "Uploading saves the file. Choose Process when you’re ready to enqueue it.",
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sage text-[10px] font-semibold text-sage-foreground">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-xs font-semibold leading-6">{step.title}</h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-7 border-t pt-6">
            <Button asChild variant="outline" className="w-full">
              <Link href="/cameras">
                Set up cameras
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
