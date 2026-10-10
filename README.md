# E-commerce Website

A production-ready single-brand e-commerce website built with a React frontend and a Node.js/Express backend.

The project is designed for a real client store. Customers can browse products, use filters, add items to a cart, check out as guests, pay online, and track orders. The client can manage products, categories, variants, stock, images, and orders through the admin side.

## Tech Stack

### Frontend
- React
- TypeScript
- Vercel for deployment

### Backend
- Node.js
- Express.js
- TypeScript
- REST API
- PostgreSQL
- Raw SQL with `pg`
- JWT + bcrypt for admin authentication
- Cloudinary for product images
- Razorpay for payments
- Render for backend deployment

## How the Backend Works

The backend is the main business layer of the website. The frontend sends requests to the API, and the backend validates the request, applies the business rules, talks to PostgreSQL or external services, and sends a safe response back.

### 1. Customer browses products

The frontend calls the product API.

The backend can handle:
- Search
- Category
- Brand
- Size
- Color
- Price range
- Stock availability
- Sorting
- Pagination

The backend reads the required data from PostgreSQL and returns the products to the frontend.

### 2. Product images

Product images are stored in Cloudinary.

The flow is:

```
Admin uploads image
       ↓
Backend receives image
       ↓
Cloudinary stores image
       ↓
Cloudinary URL is saved in PostgreSQL
       ↓
Frontend displays the image
```

The database stores the image URL, not the actual image file.

### 3. Admin login

Only administrators need an account at this stage.

The admin sends an email and password to the backend. The backend:
1. Finds the admin in PostgreSQL.
2. Checks the password using bcrypt.
3. Creates a JWT token.
4. Returns the token to the admin frontend.

Protected admin routes check this token before allowing changes.

Customer login is intentionally not required right now. Guest checkout is supported.

### 4. Product and category management

After logging in, the admin can manage:
- Products
- Categories
- Product images
- Variants
- SKU
- Size
- Color
- Price
- Stock
- Product status

The admin frontend sends these changes to protected API routes. The backend validates the request and updates PostgreSQL.

### 5. Cart

Customers can use a cart without creating an account.

A cart can be connected to a session, and cart items contain:
- Product
- Variant
- Quantity

Before adding or changing an item, the backend checks that the product/variant exists and that enough stock is available.

### 6. Checkout and orders

The customer enters:
- Name
- Email
- Phone
- Shipping address

The backend creates a pending order and stores an order snapshot.

The order stores the product name, SKU, size, color, quantity, and price at the time of purchase. This keeps old orders correct even if the product is changed later.

### 7. Inventory reservation

Stock is protected during checkout.

When an order is created, the backend temporarily reserves the required stock. The current reservation period is 15 minutes.

```
Checkout
   ↓
Create pending order
   ↓
Reserve stock
   ↓
Customer completes payment
   ↓
Payment successful → stock is consumed
Payment failed/expired → reservation is released
```

This helps prevent two customers from buying the same last item at the same time.

### 8. Payment with Razorpay

The backend creates the Razorpay payment order.

The frontend opens Razorpay Checkout using the information returned by the backend.

After payment, the backend verifies the Razorpay signature. The backend does not trust a simple "payment successful" message from the browser.

Razorpay webhooks are also handled by the backend so payment events can be confirmed server-side.

### 9. Order tracking

Customers can track an order using:
- Order number
- Email address

The backend returns safe order information such as order status, payment status, items, and totals.

Sensitive internal information is not returned to the customer.

### 10. Admin order management

Admins can:
- View orders
- Search and filter orders
- Open order details
- Update order status
- Cancel orders

Supported order statuses include:

```
pending → confirmed → processing → shipped → delivered
                         ↓
                      cancelled
```

Inventory reservations are also handled when orders are cancelled.

### 11. Inventory management

Admins can view and update variant stock.

The backend prevents an admin from setting stock below the amount already reserved for active orders.

For products with variants, stock is stored on the variant using `product_variants.stock_quantity`.

### 12. Security and validation

The backend includes:
- Helmet security headers
- CORS protection
- Request rate limiting
- Request validation
- JWT authentication
- Admin role protection
- bcrypt password hashing
- Centralized error handling
- Parameterized SQL queries

Secrets are loaded through environment variables and should never be committed to GitHub.

## Backend Folder Structure

```
backend/
├── src/
│   ├── config/          # Database and Cloudinary setup
│   ├── controllers/     # Request/business logic
│   ├── middleware/      # Auth, validation, security, uploads
│   ├── routes/          # API endpoints
│   ├── services/        # External/business services
│   ├── models/          # Database-related layer
│   ├── utils/           # Shared utilities
│   └── server.ts        # Express server
├── database/
│   ├── migrations/      # Database table changes
│   └── seed/            # Development seed data
├── .env.example         # Environment variable template
├── package.json
└── tsconfig.json
```

## Main API Areas

| Area | Purpose |
|---|---|
| `/api/products` | Product listing, search and filters |
| `/api/categories` | Categories |
| `/api/auth` | Admin login |
| `/api/admin/products` | Admin product management |
| `/api/admin/variants` | Product variant management |
| `/api/admin/inventory` | Stock management |
| `/api/admin/orders` | Admin order management |
| `/api/cart` | Guest cart |
| `/api/orders` | Checkout and order tracking |
| `/api/payments` | Razorpay payment operations |

## Environment Variables

Create a local `.env` file from `.env.example`.

Real secrets belong in your local `.env` file during development and in the hosting provider's environment variables in production.

Never commit the real `.env` file to GitHub.

Typical variables include:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=ecommerce_db

JWT_SECRET=your_jwt_secret

CORS_ORIGIN=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_CURRENCY=INR
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

For the real client deployment, payment and storage accounts should belong to the client/business where possible. Production secrets are added to Render, not GitHub.

## Customer Email Notifications

The backend uses Resend to send customer emails. Email sending is tied to server-side order events:

- Payment successfully verified or captured: payment confirmation with order number and amount.
- Admin changes an order's delivery status: status update with a link to order tracking.
- Payment failure: cancellation/status update when the order is marked cancelled.

Email delivery is optional until Resend is configured. If `RESEND_API_KEY` or `EMAIL_FROM` is missing, the API continues working and records that the email was skipped. Email provider failures are logged and do not undo a successful payment or order-status update.

Configure these variables in Render for the backend (and in local `backend/.env` for development):

```env
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=KVNEM <orders@your-verified-domain.com>
FRONTEND_URL=https://ecommerce-kvnem.vercel.app
STORE_NAME=KVNEM
```

Before production sending, verify the sender/domain in Resend. Keep `RESEND_API_KEY` secret in Render and local environment files; never expose it in frontend `VITE_*` variables or commit a real key to GitHub. The sender address must use a domain or sender that Resend allows for your account. Use the exact deployed storefront URL for `FRONTEND_URL` so tracking links point to the live site.

## Local Backend Setup

From the project root:

```powershell
cd backend
npm install
npm run dev
```

The backend normally runs at:

```
http://localhost:5000
```

Health check:

```
http://localhost:5000/api/health
```

## Database

The database uses PostgreSQL.

Create the database first, then run the SQL migrations in `backend/database/migrations/` in order.

Development seed data is stored in:

```
backend/database/seed/
```

## Build

To check the TypeScript backend:

```powershell
cd backend
npm run build
```

To run the compiled backend:

```powershell
npm start
```

## Deployment

Recommended setup:

```
React frontend
     ↓
   Vercel
     ↓
Express backend
     ↓
   Render
     ↓
PostgreSQL / Cloudinary / Razorpay
```

Environment variables are configured separately on the deployment platform.

The repository also includes a GitHub Actions backend build check so TypeScript compilation is checked automatically on pushes and pull requests.

## Important Notes

- This is a single-brand store, not a multi-vendor marketplace.
- Guest checkout is supported.
- Customer accounts are intentionally not required yet.
- Product and order data are stored in PostgreSQL.
- Product images are stored in Cloudinary.
- Payment verification happens on the backend.
- Never trust payment success based only on frontend data.
- Never commit API secrets, database passwords, JWT secrets, or webhook secrets to GitHub.
- For production, use the client's own Razorpay and Cloudinary accounts where appropriate.

## Current Backend Status

The backend currently includes:
- Cart system
- Order creation
- Inventory reservations
- Razorpay payment integration
- Payment verification and webhooks
- Customer order tracking
- Admin order management
- Admin category management
- Inventory management
- Product search and filtering
- Request validation
- Security middleware
- Centralized error handling
- Deployment configuration
- GitHub Actions TypeScript build check

The backend build is checked by CI. A successful build confirms the TypeScript code compiles; it does not replace full production testing of PostgreSQL, payments, webhooks, deployment, and frontend integration.
