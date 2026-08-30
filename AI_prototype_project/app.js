"use strict";

const prototypeState = {
    currentStep: 1,
    sessionStartedAt: null,
    initialDecision: null,
    safeguards: null,
    feedback: null,
    revisedDecision: null,
    events: []
};

const screenIds = {
    1: "screen-briefing",
    2: "screen-decision",
    3: "screen-safeguards",
    4: "screen-feedback",
    5: "screen-reflection"
};

const pathwayLabels = {
    use_ai_as_proposed: "Use AI as proposed",
    use_ai_with_safeguards: "Use AI with safeguards",
    do_not_use_ai: "Do not use AI for this task",
    escalate: "Escalate the decision"
};

const stepLabels = document.querySelectorAll(".progress-step");

function loadEvents() {
    try {
        const storedEvents = localStorage.getItem("aiDecisionCoachEvents");
        prototypeState.events = storedEvents ? JSON.parse(storedEvents) : [];
    } catch (error) {
        prototypeState.events = [];
        console.warn("Prototype event log could not be loaded.", error);
    }
}

function saveEvents() {
    localStorage.setItem(
        "aiDecisionCoachEvents",
        JSON.stringify(prototypeState.events)
    );
}

function recordEvent(eventName, eventData = {}) {
    const event = {
        event: eventName,
        scenario_id: "customer-complaint-summary",
        timestamp: new Date().toISOString(),
        ...eventData
    };

    prototypeState.events.push(event);
    saveEvents();

    console.info("Prototype event recorded:", event);
}

function showScreen(stepNumber) {
    Object.entries(screenIds).forEach(([step, screenId]) => {
        const screen = document.getElementById(screenId);

        if (screen) {
            screen.hidden = Number(step) !== stepNumber;
        }
    });

    stepLabels.forEach((stepLabel, index) => {
        const visualStep = index + 1;

        stepLabel.classList.toggle("is-active", visualStep === stepNumber);
        stepLabel.classList.toggle("is-complete", visualStep < stepNumber);

        if (visualStep === stepNumber) {
            stepLabel.setAttribute("aria-current", "step");
        } else {
            stepLabel.removeAttribute("aria-current");
        }
    });

    prototypeState.currentStep = stepNumber;

    const heading = document.querySelector(
        `#${screenIds[stepNumber]} h3, #${screenIds[stepNumber]} h2`
    );

    if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
    }
}

function showError(elementId, shouldShow) {
    const element = document.getElementById(elementId);

    if (element) {
        element.hidden = !shouldShow;
    }
}

function getCheckedValues(selector) {
    return Array.from(document.querySelectorAll(selector))
        .filter((input) => input.checked)
        .map((input) => input.value);
}

function getSelectValue(selectId) {
    const select = document.getElementById(selectId);
    return select ? select.value : "";
}

function calculateTimeOnTaskSeconds() {
    if (!prototypeState.sessionStartedAt) {
        return null;
    }

    return Math.max(
        0,
        Math.round((Date.now() - prototypeState.sessionStartedAt) / 1000)
    );
}

function resetErrors() {
    document.querySelectorAll(".text-danger").forEach((element) => {
        element.hidden = true;
    });
}

function startScenario() {
    prototypeState.sessionStartedAt = Date.now();

    recordEvent("scenario_started", {
        interaction_mode: "browser"
    });

    showScreen(2);
}

function returnToBriefing() {
    showScreen(1);
}

function returnToDecision() {
    showScreen(2);
}

function returnToSafeguards() {
    showScreen(3);
}

function returnToFeedback() {
    showScreen(4);
}

function handleDecisionSubmit(event) {
    event.preventDefault();

    const selectedPath = document.querySelector(
        'input[name="decision-path"]:checked'
    );
    const rationaleField = document.getElementById("decision-rationale");
    const selectedConfidence = document.querySelector(
        'input[name="initial-confidence"]:checked'
    );

    const hasPath = Boolean(selectedPath);
    const hasRationale = Boolean(rationaleField && rationaleField.value.trim());
    const hasConfidence = Boolean(selectedConfidence);

    showError("decision-path-error", !hasPath);
    showError("rationale-error", !hasRationale);
    showError("confidence-error", !hasConfidence);

    if (!hasPath) {
        document.querySelector('input[name="decision-path"]')?.focus();
        return;
    }

    if (!hasRationale) {
        rationaleField.focus();
        return;
    }

    if (!hasConfidence) {
        document.querySelector('input[name="initial-confidence"]')?.focus();
        return;
    }

    prototypeState.initialDecision = {
        pathway: selectedPath.value,
        rationale: rationaleField.value.trim(),
        risks: getCheckedValues('input[name="risk-factor"]:checked'),
        confidence: Number(selectedConfidence.value)
    };

    recordEvent("decision_submitted", {
        decision_pathway: prototypeState.initialDecision.pathway,
        selected_risks: prototypeState.initialDecision.risks,
        confidence: prototypeState.initialDecision.confidence
    });

    showScreen(3);
}

function handleSafeguardsSubmit(event) {
    event.preventDefault();

    const requiredSelects = [
        { id: "raw-tickets", errorId: "raw-tickets-error" },
        { id: "ticket-metadata", errorId: "ticket-metadata-error" },
        { id: "deidentified-themes", errorId: "deidentified-themes-error" },
        { id: "approved-workspace", errorId: "approved-workspace-error" },
        { id: "public-tool", errorId: "public-tool-error" },
        { id: "executive-summary", errorId: "executive-summary-error" }
    ];

    let firstInvalidField = null;

    requiredSelects.forEach(({ id, errorId }) => {
        const select = document.getElementById(id);
        const isValid = Boolean(select && select.value);

        showError(errorId, !isValid);

        if (!isValid && !firstInvalidField) {
            firstInvalidField = select;
        }
    });

    const saferProcessField = document.getElementById("safer-process");
    const hasSaferProcess = Boolean(
        saferProcessField && saferProcessField.value.trim()
    );

    showError("safer-process-error", !hasSaferProcess);

    if (firstInvalidField) {
        firstInvalidField.focus();
        return;
    }

    if (!hasSaferProcess) {
        saferProcessField.focus();
        return;
    }

    prototypeState.safeguards = {
        raw_tickets: getSelectValue("raw-tickets"),
        ticket_metadata: getSelectValue("ticket-metadata"),
        deidentified_themes: getSelectValue("deidentified-themes"),
        approved_workspace: getSelectValue("approved-workspace"),
        public_tool: getSelectValue("public-tool"),
        executive_summary: getSelectValue("executive-summary"),
        safer_process: saferProcessField.value.trim()
    };

    recordEvent("safeguards_submitted", {
        raw_tickets: prototypeState.safeguards.raw_tickets,
        ticket_metadata: prototypeState.safeguards.ticket_metadata,
        deidentified_themes: prototypeState.safeguards.deidentified_themes,
        approved_workspace: prototypeState.safeguards.approved_workspace,
        public_tool: prototypeState.safeguards.public_tool,
        executive_summary: prototypeState.safeguards.executive_summary
    });

    buildFeedback();
    showScreen(4);

    recordEvent("feedback_viewed", {
        risk_dimensions_flagged: prototypeState.feedback
            .filter((item) => item.status !== "addressed")
            .map((item) => item.id)
    });
}

function buildFeedback() {
    const initial = prototypeState.initialDecision;
    const safeguards = prototypeState.safeguards;

    if (!initial || !safeguards) {
        return;
    }

    const usesSafeguardedPath = initial.pathway === "use_ai_with_safeguards";
    const choseNoAI = initial.pathway === "do_not_use_ai";
    const choseEscalation = initial.pathway === "escalate";

    const privacyAddressed =
        (safeguards.raw_tickets === "exclude" ||
            safeguards.raw_tickets === "deidentify") &&
        safeguards.ticket_metadata === "minimize_deidentify";

    const toolAddressed =
        safeguards.approved_workspace === "required" &&
        safeguards.public_tool === "not_permitted";

    const reliabilityAddressed =
        safeguards.executive_summary === "verify_review";

    const fairnessAddressed =
        initial.risks.includes("fairness_bias") ||
        /bias|fair|represent|category|group|omit/i.test(
            safeguards.safer_process
        );

    const accountabilityAddressed =
        safeguards.executive_summary === "verify_review" &&
        (initial.risks.includes("human_review") ||
            /review|manager|subject matter|owner/i.test(
                safeguards.safer_process
            ));

    prototypeState.feedback = [
        {
            id: "privacy_data_handling",
            title: "Privacy / data handling",
            status: privacyAddressed ? "addressed" : "attention",
            label: privacyAddressed ? "Addressed" : "Attention needed",
            text: privacyAddressed
                ? "Your workflow limits raw ticket content and treats metadata as information that must be minimized and de-identified before approved use."
                : "Raw customer tickets and related metadata can contain personal or sensitive information. Do not place raw content in a public tool; use only minimum necessary, de-identified inputs when policy allows."
        },
        {
            id: "tool_authorization",
            title: "Tool authorization",
            status: toolAddressed ? "addressed" : "attention",
            label: toolAddressed ? "Addressed" : "Attention needed",
            text: toolAddressed
                ? "You selected the approved internal workspace and excluded the public tool for this AI-assisted task."
                : "The proposed public tool is not authorized for this scenario under the fictional standard. If AI is used, use an approved internal workspace and confirm that the intended data is permitted."
        },
        {
            id: "reliability_verification",
            title: "Reliability / verification",
            status: reliabilityAddressed ? "addressed" : "review",
            label: reliabilityAddressed ? "Addressed" : "Review required",
            text: reliabilityAddressed
                ? "You included verification against source information and required human review before executive distribution."
                : "An executive-facing summary should be checked against source information for accuracy, omissions, and unsupported conclusions before it is shared."
        },
        {
            id: "fairness_bias",
            title: "Fairness / bias",
            status: fairnessAddressed ? "addressed" : "review",
            label: fairnessAddressed ? "Addressed" : "Review required",
            text: fairnessAddressed
                ? "You identified the need to examine whether the summary fairly represents complaint themes and does not obscure smaller or atypical customer experiences."
                : "Check whether the analysis overemphasizes frequent categories or obscures smaller, atypical, or disproportionately affected customer groups."
        },
        {
            id: "human_accountability",
            title: "Human accountability",
            status: accountabilityAddressed ? "addressed" : "attention",
            label: accountabilityAddressed ? "Addressed" : "Attention needed",
            text: accountabilityAddressed
                ? "Your process keeps a human reviewer accountable for the executive-ready output."
                : "A human owner must remain accountable for reviewing the AI-assisted summary before it is distributed. If decision authority or policy ownership is unclear, escalate."
        }
    ];

    const allCriticalSafeguardsAddressed =
        privacyAddressed &&
        toolAddressed &&
        reliabilityAddressed &&
        accountabilityAddressed;

    let summary = "";

    if (choseNoAI) {
        summary =
            "Your decision avoids the immediate data-handling risks. The safeguard choices still show how the task would need to be handled if an approved AI workflow were considered later.";
    } else if (choseEscalation) {
        summary =
            "Escalation is a responsible pathway when authorization or ownership is unclear. The risk check below identifies the questions an appropriate internal owner would need to resolve.";
    } else if (usesSafeguardedPath && allCriticalSafeguardsAddressed) {
        summary =
            "Your decision identifies a defensible AI-assisted workflow: use only approved, minimum-necessary inputs; keep the public tool out of scope; verify output; and retain human accountability.";
    } else {
        summary =
            "Your response recognizes the task need, but additional safeguards are needed before an AI-assisted workflow could proceed under the fictional policy guidance.";
    }

    renderFeedback(summary);
}

function renderFeedback(summary) {
    const initial = prototypeState.initialDecision;
    const feedbackSummary = document.getElementById("feedback-summary");
    const decisionPath = document.getElementById("feedback-decision-path");
    const rationale = document.getElementById("feedback-rationale");
    const cardsContainer = document.getElementById("feedback-cards");

    if (feedbackSummary) {
        feedbackSummary.textContent = summary;
    }

    if (decisionPath) {
        decisionPath.textContent = pathwayLabels[initial.pathway];
    }

    if (rationale) {
        rationale.textContent = initial.rationale;
    }

    if (cardsContainer) {
        cardsContainer.innerHTML = prototypeState.feedback
            .map(
                (item) => `
                    <div class="col-md-6">
                        <article class="feedback-card status-${item.status}">
                            <span class="status-label">${item.label}</span>
                            <h5 class="fw-bold mt-3">${item.title}</h5>
                            <p class="mb-0">${item.text}</p>
                        </article>
                    </div>
                `
            )
            .join("");
    }
}

function populateReflectionScreen() {
    const originalPathway = document.getElementById("original-pathway");
    const originalConfidence = document.getElementById("original-confidence");

    if (prototypeState.initialDecision && originalPathway) {
        originalPathway.textContent =
            pathwayLabels[prototypeState.initialDecision.pathway];
    }

    if (prototypeState.initialDecision && originalConfidence) {
        originalConfidence.textContent =
            `${prototypeState.initialDecision.confidence} of 5`;
    }
}

function reviseDecision() {
    populateReflectionScreen();
    showScreen(5);
}

function getCoverageStatus(label, addressed) {
    const statusClass = addressed ? "status-addressed" : "status-review";
    const statusLabel = addressed ? "Addressed in response" : "Needs attention";

    return `
        <div class="col-md-6 col-lg-4">
            <article class="feedback-card ${statusClass}">
                <span class="status-label">${statusLabel}</span>
                <h5 class="fw-bold mt-3 mb-0">${label}</h5>
            </article>
        </div>
    `;
}

function handleReflectionSubmit(event) {
    event.preventDefault();

    const revisedPath = document.querySelector(
        'input[name="revised-path"]:checked'
    );
    const revisedRationaleField = document.getElementById("revised-rationale");
    const revisedConfidence = document.querySelector(
        'input[name="revised-confidence"]:checked'
    );
    const reflectionField = document.getElementById("reflection-response");
    const transferDecision = document.getElementById("transfer-decision");

    const hasPath = Boolean(revisedPath);
    const hasRationale = Boolean(
        revisedRationaleField && revisedRationaleField.value.trim()
    );
    const hasConfidence = Boolean(revisedConfidence);
    const hasReflection = Boolean(
        reflectionField && reflectionField.value.trim()
    );
    const hasTransferDecision = Boolean(
        transferDecision && transferDecision.value
    );

    showError("revised-path-error", !hasPath);
    showError("revised-rationale-error", !hasRationale);
    showError("revised-confidence-error", !hasConfidence);
    showError("reflection-error", !hasReflection);
    showError("transfer-error", !hasTransferDecision);

    if (!hasPath) {
        document.querySelector('input[name="revised-path"]')?.focus();
        return;
    }

    if (!hasRationale) {
        revisedRationaleField.focus();
        return;
    }

    if (!hasConfidence) {
        document.querySelector('input[name="revised-confidence"]')?.focus();
        return;
    }

    if (!hasReflection) {
        reflectionField.focus();
        return;
    }

    if (!hasTransferDecision) {
        transferDecision.focus();
        return;
    }

    prototypeState.revisedDecision = {
        pathway: revisedPath.value,
        rationale: revisedRationaleField.value.trim(),
        confidence: Number(revisedConfidence.value),
        reflection: reflectionField.value.trim(),
        transfer_decision: transferDecision.value
    };

    recordEvent("decision_revised", {
        initial_path: prototypeState.initialDecision.pathway,
        revised_path: prototypeState.revisedDecision.pathway,
        initial_confidence: prototypeState.initialDecision.confidence,
        revised_confidence: prototypeState.revisedDecision.confidence
    });

    recordEvent("transfer_completed", {
        transfer_decision: prototypeState.revisedDecision.transfer_decision,
        time_on_task_seconds: calculateTimeOnTaskSeconds()
    });

    renderCompletionSummary();
}

function renderCompletionSummary() {
    const completionSection = document.getElementById("completion-summary");
    const summaryText = document.getElementById("completion-summary-text");
    const competencySummary = document.getElementById("competency-summary");
    const eventLogOutput = document.getElementById("event-log-output");

    if (!prototypeState.revisedDecision || !prototypeState.feedback) {
        return;
    }

    const revisedPathLabel =
        pathwayLabels[prototypeState.revisedDecision.pathway];

    if (summaryText) {
        summaryText.textContent =
            `You revised your pathway from "${pathwayLabels[prototypeState.initialDecision.pathway]}" to "${revisedPathLabel}" and recorded confidence of ${prototypeState.revisedDecision.confidence} of 5. The response coverage below reflects the information captured across your submitted workflow and revised reasoning; it is not a final compliance or performance score.`;
    }

    const saferProcessText = prototypeState.safeguards.safer_process;
    const revisedRationaleText = prototypeState.revisedDecision.rationale;
    const reflectionText = prototypeState.revisedDecision.reflection;
    const combinedText =
        `${saferProcessText} ${revisedRationaleText} ${reflectionText}`;

    const initialFeedbackById = Object.fromEntries(
        prototypeState.feedback.map((item) => [item.id, item.status])
    );

    const coverage = [
        {
            label: "Data boundaries",
            addressed:
                initialFeedbackById.privacy_data_handling === "addressed" ||
                /de-identified|deidentified|minimum necessary|remove.*identif|exclude.*raw/i.test(combinedText)
        },
        {
            label: "Tool selection",
            addressed:
                initialFeedbackById.tool_authorization === "addressed" ||
                /approved.*(tool|workspace)|internal.*(tool|workspace)|public tool.*(not|avoid|exclude)/i.test(combinedText)
        },
        {
            label: "Output verification",
            addressed:
                /verify|check.*source|source.*check|review.*output|validate/i.test(combinedText)
        },
        {
            label: "Escalation judgment",
            addressed:
                prototypeState.revisedDecision.pathway === "escalate" ||
                /escalat|owner|policy.*unclear|authority.*unclear/i.test(combinedText)
        },
        {
            label: "Prompt / process design",
            addressed:
                prototypeState.safeguards.safer_process.length >= 50 &&
                prototypeState.revisedDecision.rationale.length >= 50
        }
    ];

    if (competencySummary) {
        competencySummary.innerHTML = coverage
            .map((item) => getCoverageStatus(item.label, item.addressed))
            .join("");
    }

    if (eventLogOutput) {
        eventLogOutput.textContent = JSON.stringify(
            prototypeState.events,
            null,
            2
        );
    }

    if (completionSection) {
        completionSection.hidden = false;
        completionSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

function restartPrototype() {
    document.querySelectorAll("form").forEach((form) => form.reset());

    resetErrors();

    prototypeState.currentStep = 1;
    prototypeState.sessionStartedAt = null;
    prototypeState.initialDecision = null;
    prototypeState.safeguards = null;
    prototypeState.feedback = null;
    prototypeState.revisedDecision = null;

    const completionSection = document.getElementById("completion-summary");
    if (completionSection) {
        completionSection.hidden = true;
    }

    showScreen(1);
}

function clearEventLog() {
    const confirmed = window.confirm(
        "Clear all browser-local prototype events for this scenario?"
    );

    if (!confirmed) {
        return;
    }

    prototypeState.events = [];
    localStorage.removeItem("aiDecisionCoachEvents");

    const eventLogOutput = document.getElementById("event-log-output");
    if (eventLogOutput) {
        eventLogOutput.textContent = "[]";
    }

    console.info("Prototype event log cleared.");
}

function initializePrototype() {
    loadEvents();

    const startButton = document.getElementById("start-scenario");
    const backToBriefingButton = document.getElementById("back-to-briefing");
    const backToDecisionButton = document.getElementById("back-to-decision");
    const backToSafeguardsButton = document.getElementById("back-to-safeguards");
    const backToFeedbackButton = document.getElementById("back-to-feedback");
    const reviseDecisionButton = document.getElementById("revise-decision");
    const restartButton = document.getElementById("restart-prototype");
    const clearEventLogButton = document.getElementById("clear-event-log");
    const decisionForm = document.getElementById("decision-form");
    const safeguardsForm = document.getElementById("safeguards-form");
    const reflectionForm = document.getElementById("reflection-form");

    if (startButton) {
        startButton.addEventListener("click", startScenario);
    }

    if (backToBriefingButton) {
        backToBriefingButton.addEventListener("click", returnToBriefing);
    }

    if (backToDecisionButton) {
        backToDecisionButton.addEventListener("click", returnToDecision);
    }

    if (backToSafeguardsButton) {
        backToSafeguardsButton.addEventListener("click", returnToSafeguards);
    }

    if (backToFeedbackButton) {
        backToFeedbackButton.addEventListener("click", returnToFeedback);
    }

    if (reviseDecisionButton) {
        reviseDecisionButton.addEventListener("click", reviseDecision);
    }

    if (restartButton) {
        restartButton.addEventListener("click", restartPrototype);
    }

    if (clearEventLogButton) {
        clearEventLogButton.addEventListener("click", clearEventLog);
    }

    if (decisionForm) {
        decisionForm.addEventListener("submit", handleDecisionSubmit);
    }

    if (safeguardsForm) {
        safeguardsForm.addEventListener("submit", handleSafeguardsSubmit);
    }

    if (reflectionForm) {
        reflectionForm.addEventListener("submit", handleReflectionSubmit);
    }
}

document.addEventListener("DOMContentLoaded", initializePrototype);