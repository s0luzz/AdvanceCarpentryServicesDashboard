import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { FeedbackProvider } from "./components/ui/Feedback";
import "./index.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <FeedbackProvider>
                <App />
            </FeedbackProvider>
        </BrowserRouter>
    </StrictMode>
);
