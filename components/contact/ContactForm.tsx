"use client";

import { submitContactForm } from "@/actions/contact";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const contactFormSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(2, { message: t("form.validation.nameMin") }),
  email: z.string().email({ message: t("form.validation.emailInvalid") }),
  subject: z.string().min(5, { message: t("form.validation.subjectMin") }),
  message: z.string().min(10, { message: t("form.validation.messageMin") }),
});

type ContactFormValues = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export default function ContactForm({ locale }: { locale: string }) {
  const t = useTranslations("Contact");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema(t)),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  async function onSubmit(values: ContactFormValues) {
    setIsSubmitting(true);
    try {
      const result = await submitContactForm({
        ...values,
        locale,
      });

      if (result.success) {
        toast.success(t("form.success"));
        form.reset();
      } else {
        toast.error(result.error || t("form.error"));
      }
    } catch (error) {
      console.error("Contact form error:", error);
      toast.error(t("form.error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("form.name")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("form.namePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("form.email")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("form.emailPlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.subject")}</FormLabel>
              <FormControl>
                <Input placeholder={t("form.subjectPlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.message")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("form.messagePlaceholder")}
                  className="min-h-[150px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("form.sending")}
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              {t("form.submit")}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
