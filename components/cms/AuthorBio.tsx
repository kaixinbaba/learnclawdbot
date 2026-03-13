import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations } from "next-intl";

interface AuthorBioProps {
  authorName?: string;
  authorRole?: string;
  authorBio?: string;
  authorImage?: string;
}

export function AuthorBio({
  authorName = "Learn OpenClaw Team",
  authorRole = "AI Automation Experts",
  authorBio,
  authorImage = "/logo.png",
}: AuthorBioProps) {
  const t = useTranslations("Blogs.BlogDetail");

  const defaultBio = "We are a dedicated group of AI automation enthusiasts and early adopters of the OpenClaw ecosystem. Our mission is to provide technically accurate, beginner-friendly tutorials to help the community master autonomous AI agents.";

  return (
    <div className="bg-muted/50 rounded-xl p-8 mt-16 border flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Avatar className="w-24 h-24 border-4 border-background shadow-sm shrink-0">
        <AvatarImage src={authorImage} alt={authorName} className="object-cover" />
        <AvatarFallback>{authorName.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
          <h3 className="text-xl font-bold">{authorName}</h3>
          <span className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded-full w-fit mx-auto md:mx-0">
            {authorRole}
          </span>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-4 text-sm md:text-base">
          {authorBio || defaultBio}
        </p>
        <div className="flex flex-wrap justify-center md:justify-start gap-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Verified Experts
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Open Source Contributors
          </div>
        </div>
      </div>
    </div>
  );
}
