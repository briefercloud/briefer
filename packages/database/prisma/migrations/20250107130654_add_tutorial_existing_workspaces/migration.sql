-- Insert a completed tutorial for all workspaces without an existing tutorial
INSERT INTO "OnboardingTutorial" ("workspaceId", "currentStep", "isComplete", "isDismissed")
SELECT
    w."id",              -- Workspace ID
    'inviteTeamMembers', -- Set the current step to the last step of the tutorial
    true,                -- Mark the tutorial as complete
    true                 -- Mark as dismissed
FROM
    "Workspace" w
LEFT JOIN
    "OnboardingTutorial" ot ON w."id" = ot."workspaceId"
WHERE
    ot."workspaceId" IS NULL; -- Only add for workspaces without a tutorial
