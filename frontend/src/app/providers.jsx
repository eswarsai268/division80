import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "./queryClient";
import { LanguageProvider } from "../i18n";

export default function Providers({ children }) {
  return <QueryClientProvider client={queryClient}><LanguageProvider><BrowserRouter>{children}</BrowserRouter></LanguageProvider></QueryClientProvider>;
}
