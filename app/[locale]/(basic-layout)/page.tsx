import HomeComponent from "@/components/home";

type Params = Promise<{ locale: string }>;

export default async function Home({ params }: { params: Params }) {
  const { locale } = await params;
  return <HomeComponent locale={locale} />;
}
