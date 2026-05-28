import de from "@/messages/de.json";
import en from "@/messages/en.json";
import it from "@/messages/it.json";
import { defaultLocale, type Locale } from "./routing";

const dictionaries = {
  de,
  en,
  it
};

export type Messages = typeof de;

export async function getMessages(locale: Locale = defaultLocale): Promise<Messages> {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}
