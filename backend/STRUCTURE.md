# Backend folder structure plan

This document maps the existing backend files to a simpler feature-based structure.

## Safety rule

Keep the current working `backend/src` layout until the code is moved and the build is verified. Do not create duplicate implementations or move files directly on `main`. Use this plan on the `chore/backend-structure-plan` branch first.

## Target project layout

```text
ecommerce/
├── frontend/                 # Existing React website; leave unchanged
├── backend/
│   ├── database/              # SQL migrations and seed scripts
│   ├── authentication/        # Customer signup, OAuth and admin login
│   ├── email/                 # Verification, OTP and transactional email flows
│   ├── users/                 # Customer profiles and account data
│   ├── products/              # Product and category logic
│   ├── cart/                  # Shopping cart logic
│   ├── orders/                # Order creation and history
│   ├── payments/              # Payment business logic
│   ├── delivery/              # Delivery statuses and tracking
│   ├── promotions/            # Homepage offers and discount rules
│   ├── inventory/             # Stock and availability
│   ├── admin/                 # Admin-only operations
│   ├── uploads/               # Image upload handling
│   ├── config/                # Database and service configuration
│   ├── middleware/            # Authentication, validation and error handling
│   ├── utils/                 # Shared helpers
│   ├── integrations/          # External provider adapters (Razorpay, Cloudinary,
│   │                          # email provider and OAuth providers)
│   ├── app.ts                 # Express app and route registration
│   ├── server.ts              # Startup
│   ├── package.json
│   └── .env.example
└── README.md
```

## Where existing code belongs

| Existing path | Intended destination |
|---|---|
| `backend/database/migrations/` | Keep at `backend/database/migrations/` |
| `backend/database/seed/` | Keep at `backend/database/seed/` |
| `backend/src/config/database.ts` | `backend/config/database.ts` |
| `backend/src/config/cloudinary.ts` | `backend/integrations/cloudinary/` or `backend/config/cloudinary.ts` |
| `backend/src/controllers/auth.controller.ts` and `backend/src/routes/auth.routes.ts` | `backend/authentication/` |
| `backend/src/controllers/product.controller.ts`, `category.controller.ts`, and matching routes | `backend/products/` |
| `backend/src/controllers/cart.controller.ts` and `backend/src/routes/cart.routes.ts` | `backend/cart/` |
| `backend/src/controllers/order.controller.ts` and `backend/src/routes/order.routes.ts` | `backend/orders/` |
| `backend/src/controllers/payment.controller.ts`, `backend/src/routes/payment.routes.ts`, `backend/src/services/payment.service.ts` | `backend/payments/`, with Razorpay-specific API calls in `backend/integrations/razorpay/` |
| `backend/src/controllers/admin-order.controller.ts` and `backend/src/routes/admin-order.routes.ts` | `backend/admin/` or shared order module with admin-only routes |
| `backend/src/controllers/admin-inventory.controller.ts` and matching route | `backend/inventory/` with admin-only operations |
| `backend/src/controllers/admin-product.controller.ts`, `admin-category.controller.ts`, `admin-variant.controller.ts`, and matching routes | `backend/products/` and `backend/admin/` |
| `backend/src/controllers/admin-image.controller.ts`, `backend/src/routes/admin-image.routes.ts`, and `backend/src/middleware/upload.middleware.ts` | `backend/uploads/` |
| `backend/src/middleware/` | `backend/middleware/` |
| `backend/src/utils/migrations.ts` | Keep as `backend/utils/migrations.ts` or leave in startup utilities |
| `backend/src/server.ts` | Split into `backend/app.ts` and `backend/server.ts` only after updating imports and testing |
| `backend/src/models/` | Keep only if actual shared data models are added; avoid empty placeholder folders |

## Integration rule

Business modules decide *when and why* a service is used. The `integrations/` folder contains the provider-specific communication code. For example, `orders/` decides when an order confirmation email is needed; `integrations/email-provider/` sends it.

## Before merging a restructure

1. Update every affected relative import.
2. Check `backend/package.json`, `backend/tsconfig.json`, `backend/render.yaml`, and the root `render.yaml` for build/start paths.
3. Run `npm install` and `npm run build` from `backend/`.
4. Test health, product listing, admin login, image upload, cart, order and payment-status endpoints.
5. Confirm Render deploys successfully before merging to `main`.

The current deployed structure should remain unchanged until these checks pass.
