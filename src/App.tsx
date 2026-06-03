import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SHARED_RESULT_QUERY_PARAM } from "@/game/shareResult";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { SharedResultPage } from "./pages/SharedResult.tsx";

const queryClient = new QueryClient();

/** Returns the stable directory prefix used by archive-hosted builds. */
function getYandexBasename() {
  const baseDir = new URL(".", window.location.href).pathname;
  const normalized = baseDir.endsWith("/") ? baseDir.slice(0, -1) : baseDir;
  return normalized === "" ? "/" : normalized;
}

const yandexBasename = import.meta.env.MODE === "yandex" ? getYandexBasename() : undefined;

const AppRoutes = () => {
  const [searchParams] = useSearchParams();
  const sharedResultToken = searchParams.get(SHARED_RESULT_QUERY_PARAM);

  if (sharedResultToken !== null) {
    return <SharedResultPage token={sharedResultToken} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/index.html" element={<Index />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={yandexBasename}>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
