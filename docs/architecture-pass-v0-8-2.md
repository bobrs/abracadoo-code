# Abracadoo HumanKey V0.8.2 - Inbound Path Invite Export Clarity

V0.8.2 is a tiny UX cleanup after V0.8.1.

Opening an inbound Path no longer automatically downloads a Path invite file.

The flow is now:

1. Open inbound Path.
   - Creates the local receiving Path.
   - Stores the private receive key in the encrypted local vault.
   - Prepares the public Path invite text in the panel.
   - Does not auto-save a file.

2. Export or Copy Path invite.
   - Deliberately creates the shareable public invite artifact.
   - Records the invite as shared when exported.
   - Downloads or copies only when the user chooses that action.

This removes the confusing duplicate-file behavior where opening an inbound Path and exporting the invite both produced downloadable Path invite files.

The Path invite is public/shareable route information for the intended recipient. It is not a vault backup and does not contain the private receive key.
