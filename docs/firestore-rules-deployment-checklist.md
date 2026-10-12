# Firestore Rules Production Deployment Checklist

This checklist is for an authorized operator deploying the repository rules to TaskFlow's Firebase project. It does not deploy anything by itself.

## Repository facts

- Intended production Firebase project: `todo-app-7fc4b`
- Emulator/test project: `taskflow-rules-test`
- Local rules file: `firestore.rules`
- Firebase config: `firebase.json`
- The repository does not contain a `.firebaserc`, so `firebase use` is not a reliable project selector here. Always pass `--project todo-app-7fc4b` explicitly and verify the active project before any deployment.
- `index.html` initializes Firebase with `projectId: "todo-app-7fc4b"` and uses only these Firestore paths:
  - `users/{uid}/tasks/{taskId}`: snapshot reads, add, set, update, and delete
  - `users/{uid}/incidents/{incidentId}`: snapshot reads, add, update, and delete
  - `users/{uid}/notes/{noteId}`: snapshot reads, add, and delete

## Local, emulator-only verification

From the repository root:

```bash
npm ci
npm run test:rules
```

The test configuration starts the Firestore Emulator on `127.0.0.1:8080` with project ID `taskflow-rules-test`. Keep `FIRESTORE_EMULATOR_HOST` and `FIREBASE_CONFIG` pointed at that test project. Do not provide production credentials or a production project ID to the test command.

## Pre-deployment review

1. Confirm the working tree and branch contain the intended reviewed rules:

```bash
git status --short
git branch --show-current
git diff -- firestore.rules firebase.json
```

2. Confirm the Firebase CLI is authenticated and the intended project is visible:

```bash
firebase login:list
firebase projects:list
```

If `todo-app-7fc4b` is not listed, stop. Do not deploy.

3. Check the project selected for the command. Because there is no `.firebaserc`, use the explicit project flag:

```bash
firebase use --clear
firebase use todo-app-7fc4b --add
firebase use
```

The command output must identify `todo-app-7fc4b`. For every read or deploy command below, retain `--project todo-app-7fc4b`; do not rely on an ambient alias.

4. Inspect the currently deployed Firestore rules before changing them:

```bash
firebase firestore:rules:get --project todo-app-7fc4b > /tmp/taskflow-deployed-firestore.rules
sed -n '1,240p' /tmp/taskflow-deployed-firestore.rules
```

If the command fails, returns rules for an unexpected project, or produces an unexpected/empty result, stop and investigate. The repository rules must not be treated as deployed until this check succeeds.

5. Compare deployed rules with the repository rules:

```bash
diff -u /tmp/taskflow-deployed-firestore.rules firestore.rules
```

Review every difference. A non-zero `diff` means the deployed rules differ; it is not a reason to overwrite them without review. Save the output with the deployment record.

## Authorized deployment

Only after the pre-deployment checks pass and the diff has been reviewed:

```bash
firebase deploy --only firestore:rules --project todo-app-7fc4b
```

Record the Firebase CLI output, release/version information, operator, commit SHA, and timestamp. If the CLI shows any project other than `todo-app-7fc4b`, stop immediately and do not continue.

## Post-deployment verification

1. Fetch the deployed rules again and compare them to the reviewed commit:

```bash
firebase firestore:rules:get --project todo-app-7fc4b > /tmp/taskflow-deployed-firestore.rules.after
diff -u firestore.rules /tmp/taskflow-deployed-firestore.rules.after
```

2. In the application, verify Google sign-in succeeds and the authenticated user can read and write only their own:
   - tasks (create, edit, status/escalation update, delete)
   - incidents (create, status update, delete)
   - notes (create, delete)

3. With a second Google account, verify User B cannot read or modify User A's task, incident, or note documents. Verify an unauthenticated session cannot access those collections.

4. Confirm existing data remains present and unchanged for the owner after sign-in. Do not use delete or bulk cleanup operations as part of verification.

5. If any check fails, stop using the affected feature, preserve the CLI output and error, and roll back only through an explicitly reviewed Firebase rules release process. Do not weaken rules to make the check pass.

## Current status

This checklist does not inspect or claim the live deployed rules. It documents how an authorized operator can inspect them safely before deployment. Emulator tests remain isolated to `taskflow-rules-test` and do not access production Firestore.

No voice AI integration is included.
