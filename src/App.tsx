import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { getConfiguredBasename, getDirectoryBasename } from "./platform/routing";

const queryClient = new QueryClient();

// Архивная сборка для Яндекса лежит по неизвестному заранее пути, поэтому
// basename там берётся из адреса. У web-сборки путь известен на сборке.
const directoryBasename =
  import.meta.env.MODE === "web"
    ? getConfiguredBasename()
    : import.meta.env.MODE === "yandex"
      ? getDirectoryBasename()
      : undefined;

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/index.html" element={<Index />} />
    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={directoryBasename}>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
