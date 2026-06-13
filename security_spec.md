# Security Specification

## 1. Data Invariants
- Only verified admin users (`armarri975@gmail.com` or users inside the `/admins/{uid}` collection) can create, update, or delete questions.
- A question must have non-empty prompt text, 4 valid non-empty options (A, B, C, D), and a correct answer which is strictly one of 'A', 'B', 'C', 'D'.
- All fields: `text`, `options`, `correctAnswer`, `createdAt`, `createdBy` are required.
- Standard users (unauthenticated or normal authenticated users) can only read (`get`, `list`) questions. They cannot mutate any data.
- The `createdAt` timestamp is immutable once created.

## 2. The "Dirty Dozen" Hostile Payloads
The following payloads should be explicitly blocked by the rules to maintain data integrity:

1. **Self-Promoting Admin (Privilege Escalation)**: Creating a record in `/admins/{uid}` by a non-admin user.
2. **Ghost Option Injection**: Adding a question with five options (A, B, C, D, E) or missing options.
3. **Invalid Correct Answer**: Setting `correctAnswer` to 'E' or 'Z'.
4. **Empty Question Text**: Setting `text` to an empty string `""` or a extremely large string (>1000 characters).
5. **No Options Field**: Attempting to create a question without options.
6. **Self-Forging Author**: Setting the `createdBy` property to another developer's UID.
7. **Modifying Immortal Field**: Attempting to update `createdAt` or `createdBy` on an existing question.
8. **Junk Question ID Injection**: Using a 5KB document ID of special symbols for `/questions/{id}`.
9. **Tampering with Correct Answer**: Option change or answer alteration by a non-admin.
10. **Bypassing Server Timestamps**: Providing a client-forged timestamp for `createdAt` during creation.
11. **Anonymously Deleting Questions**: Bypassing admin authentication on delete.
12. **Bypassing Schema validation**: Injecting unexpected types into string properties (e.g., array instead of string for `text`).

## 3. Firestore Rules Layout

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() && (
        request.auth.token.email_verified == true && (
          request.auth.token.email == 'armarri975@gmail.com' ||
          exists(/databases/$(database)/documents/admins/$(request.auth.uid))
        )
      );
    }

    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    function isValidQuestion(q) {
      return q.text is string && q.text.size() > 0 && q.text.size() <= 1000 &&
             q.correctAnswer is string && (q.correctAnswer == 'A' || q.correctAnswer == 'B' || q.correctAnswer == 'C' || q.correctAnswer == 'D') &&
             q.createdBy is string && q.createdBy == request.auth.uid &&
             q.options is map &&
             q.options.A is string && q.options.A.size() > 0 && q.options.A.size() <= 500 &&
             q.options.B is string && q.options.B.size() > 0 && q.options.B.size() <= 500 &&
             q.options.C is string && q.options.C.size() > 0 && q.options.C.size() <= 500 &&
             q.options.D is string && q.options.D.size() > 0 && q.options.D.size() <= 500 &&
             q.keys().hasAll(['text', 'options', 'correctAnswer', 'createdAt', 'createdBy']) &&
             q.keys().size() == 5;
    }

    match /admins/{adminId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /questions/{questionId} {
      allow read, list: if true;
      allow create: if isAdmin() && isValidId(questionId) && isValidQuestion(request.resource.data) && request.resource.data.createdAt == request.time;
      allow update: if isAdmin() && isValidId(questionId) && isValidQuestion(request.resource.data) && request.resource.data.createdAt == resource.data.createdAt;
      allow delete: if isAdmin() && isValidId(questionId);
    }
  }
}
```
