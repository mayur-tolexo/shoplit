package uploads

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Store persists an uploaded image and returns a URL that renders it.
type Store interface {
	Put(ctx context.Context, name, contentType string, data []byte) (string, error)
}

// DiskStore writes files under a directory; they're served back at /uploads/<name>.
// Used in local dev (no S3). Returns a same-origin relative URL.
type DiskStore struct{ dir string }

func NewDiskStore(dir string) *DiskStore { return &DiskStore{dir: dir} }

func (d *DiskStore) Put(_ context.Context, name, _ string, data []byte) (string, error) {
	if err := os.MkdirAll(d.dir, 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(d.dir, name), data, 0o644); err != nil {
		return "", err
	}
	return "/uploads/" + name, nil
}

// S3Store uploads to an S3 bucket and returns the public object URL. Credentials
// come from the default AWS chain (EC2 instance role in prod). The bucket is
// expected to allow public GetObject so the image renders directly.
type S3Store struct {
	client *s3.Client
	bucket string
	region string
}

// NewS3Store builds an S3-backed store. Region defaults via the AWS chain if empty.
func NewS3Store(ctx context.Context, bucket, region string) (*S3Store, error) {
	opts := []func(*awsconfig.LoadOptions) error{}
	if region != "" {
		opts = append(opts, awsconfig.WithRegion(region))
	}
	cfg, err := awsconfig.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}
	return &S3Store{client: s3.NewFromConfig(cfg), bucket: bucket, region: cfg.Region}, nil
}

func (s *S3Store) Put(ctx context.Context, name, contentType string, data []byte) (string, error) {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(name),
		Body:          bytes.NewReader(data),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(int64(len(data))),
		// No ACL: buckets default to "ACLs disabled" (bucket-owner-enforced);
		// public read is granted by the bucket policy, not per-object ACLs.
	})
	if err != nil {
		return "", fmt.Errorf("s3 put: %w", err)
	}
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucket, s.region, name), nil
}
