# S3 image uploads — setup runbook

Region: **ap-southeast-2 (Sydney)**. Auth: **EC2 instance role** (no access keys).
Goal: creator photo uploads go to S3 and render via the public object URL.

## 1. Create the bucket
S3 console (top-right region = **ap-southeast-2**) → **Create bucket**.
- **Name:** `shoplit-uploads-prod` (must be globally unique — add a suffix if taken).
- **Region:** Asia Pacific (Sydney) ap-southeast-2.
- Leave the rest default for now → **Create bucket**.

## 2. Make uploaded objects publicly readable
Product images are public, so allow read-only GET.
1. Bucket → **Permissions** → **Block public access (bucket settings)** → **Edit** →
   uncheck **Block all public access** → Save → type `confirm`.
2. Same tab → **Bucket policy** → **Edit** → paste (replace the name if you changed it):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::shoplit-uploads-prod/*"
  }]
}
```
→ Save. (This grants read on objects only; nobody can write or list.)

## 3. Let the EC2 instance upload (instance role)
1. EC2 console → **Instances** → your instance → **Security** tab → look at **IAM Role**.
   - If a role is attached, note its name.
   - If **none**: IAM → **Roles** → **Create role** → trusted entity **AWS service** →
     use case **EC2** → Next → Next → name `shoplit-ec2-role` → Create. Then back in
     EC2 → select instance → **Actions → Security → Modify IAM role** → pick
     `shoplit-ec2-role` → Update.
2. IAM → **Roles** → open that role → **Add permissions → Create inline policy** →
   **JSON** → paste:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject"],
    "Resource": "arn:aws:s3:::shoplit-uploads-prod/*"
  }]
}
```
→ Next → name `shoplit-s3-put` → Create policy.

No CORS configuration is needed (the server does the upload; `<img>` rendering doesn't require CORS).

## 4. Hand back to me
Send the **bucket name**. I set on the server (`deploy/.env`) and redeploy the API:
```
SHOPLIT_S3_BUCKET=shoplit-uploads-prod
AWS_REGION=ap-southeast-2
```
When `SHOPLIT_S3_BUCKET` is set, the upload handler uses S3; otherwise it falls back
to local disk (dev). URLs returned look like
`https://shoplit-uploads-prod.s3.ap-southeast-2.amazonaws.com/<random>.jpg`.

## Retention & upload limits (decided 2026-05-25)
- **No expiry lifecycle.** Product/cover images must live as long as their cart,
  so we deliberately do NOT auto-delete by age (a flat 30-day rule would break
  images on older carts). Storage growth is controlled at intake instead.
- **Upload limits (enforced server-side in `internal/uploads`):**
  - **5 MB** max per image (`maxUploadBytes`), JPEG/PNG/WebP/GIF only.
  - **30 uploads/hour per creator** (Redis fixed-window, `NewRedisLimiter`);
    over the cap → HTTP 429. The web picker also pre-checks 5 MB client-side.
- **Optional S3 hygiene rule** (no data loss, safe to add in the console):
  Bucket → Management → Lifecycle rule → "Delete incomplete multipart uploads
  after 7 days". Our uploads are single-part PutObject, so this is effectively a
  no-op today — add it only as a best-practice belt.
- The EC2 instance role has **`s3:PutObject` only** (no `DeleteObject`/lifecycle),
  so neither the app nor a stray script can delete bucket objects.

## 5. (Optional) verify the role works, from the EC2 box
```
aws sts get-caller-identity                 # shows the assumed role
echo hi > /tmp/t.txt && aws s3 cp /tmp/t.txt s3://shoplit-uploads-prod/t.txt
curl -I https://shoplit-uploads-prod.s3.ap-southeast-2.amazonaws.com/t.txt   # expect 200
aws s3 rm s3://shoplit-uploads-prod/t.txt
```
(If the AWS CLI isn't installed, skip — the app's SDK uses the same role.)
