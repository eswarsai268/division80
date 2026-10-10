import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "./queryClient";

export default function Providers({ children }) {
  return <QueryClientProvider client={queryClient}><BrowserRouter>{children}</BrowserRouter></QueryClientProvider>;
}
