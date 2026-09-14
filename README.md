# Darul Aman Academy — Complete Website & Management System

Darul Aman Academy is a residential Islamic madrasa in Cox's Bazar, Bangladesh, offering Hifz-ul-Quran, Qaida, Nazera, and full academic education for boys with modern facilities and a caring learning environment.

## 🌐 Project Overview

This repository contains:
- **Static Website**: Public-facing website with information about the academy, departments, and services
- **Management Portal**: Role-based portal system for students, guardians, teachers, and administrators
- **Backend API**: Node.js/Express API with PostgreSQL database for managing all academy operations

## 📁 Project Structure

```
darul-aman-website/
├── index.html              # Main homepage
├── about.html              # About us page
├── contact.html            # Contact information
├── admission.html          # Admission information
├── [other pages]           # Additional public pages
├── css/                    # Stylesheets (Bootstrap + custom)
├── js/                     # JavaScript files
├── img/                    # Images and assets
├── Logo_icon/              # Logo and icon files
├── Poster_img/             # Poster images
├── Learning Garden/        # Learning materials
├── img-students/           # Student photos
├── portal/                 # Management portal (login + dashboards)
│   ├── login.html          # Portal login page
│   ├── css/                # Portal-specific styles
│   ├── js/                 # Portal JavaScript files
│   ├── admin/              # Admin dashboard pages
│   ├── guardian/           # Guardian dashboard pages
│   ├── student/            # Student dashboard pages
│   ├── teacher/            # Teacher dashboard pages
│   └── super-admin/        # Super-admin dashboard pages
├── backend/                # Backend API (Node.js + Express + Prisma)
│   ├── src/                # Source code
│   ├── prisma/             # Database schema and migrations
│   ├── package.json        # Backend dependencies
│   └── README.md           # Backend-specific documentation
├── .gitignore              # Git ignore rules
└── README.md              # This file
```

## 🚀 Getting Started

### Frontend Website (Static)

The frontend is a static HTML website that can be served directly:

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd darul-aman-website
   ```

2. **Open the website**
   - Simply open `index.html` in a web browser
   - Or use a static file server:
     ```bash
     # Using Python
     python -m http.server 8000
     
     # Using Node.js
     npx serve .
     
     # Using PHP
     php -S localhost:8000
     ```

3. **Access the portal**
   - Navigate to `portal/login.html` for the management portal login

### Backend API (Node.js + Express + PostgreSQL)

For the management portal functionality, you need to run the backend:

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL, JWT secrets, and other configuration
   ```

4. **Set up the database**
   ```bash
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:4000`

## 🌐 Deployment

### Frontend (GitHub Pages)

The static website can be deployed to GitHub Pages:

1. **Create a GitHub repository** and push this code
2. **Enable GitHub Pages** in repository settings
3. **Select the main branch** as the source
4. **Access your site** at `https://<username>.github.io/<repository-name>/`

### Backend (Heroku/Render/other platforms)

The backend can be deployed to any Node.js hosting platform:

1. **Push the backend code** to your hosting platform
2. **Set environment variables** (DATABASE_URL, JWT_SECRET, etc.)
3. **Run database migrations** on the production database
4. **Configure the domain** for API access

## 🔧 Key Features

### Public Website
- **Responsive Design**: Mobile-friendly layout
- **Multi-language Support**: Bengali, English, Arabic
- **Dark/Light Mode**: Theme switching capability
- **SEO Optimized**: Meta tags and structured data
- **Department Pages**: Information about all academy departments
- **Gallery**: Photo gallery of academy activities
- **Contact Forms**: Inquiry and admission forms

### Management Portal
- **Role-based Access**: Different dashboards for different user types
- **Student Management**: Complete student records and profiles
- **Academic Tracking**: Attendance, exams, grades, and Hifz progress
- **Fee Management**: Payment tracking and invoicing
- **Communication**: Notices and notifications system
- **Document Management**: Certificate generation and document handling

### Backend API
- **RESTful API**: Standard REST endpoints for all operations
- **Authentication**: JWT-based secure authentication
- **Authorization**: Role-based access control (RBAC)
- **Database**: PostgreSQL with Prisma ORM
- **Security**: Rate limiting, input validation, audit logging
- **File Upload**: Secure file handling for documents and images

## 📋 Technology Stack

### Frontend
- **HTML5/CSS3**: Static website structure
- **Bootstrap 5**: Responsive framework
- **Vanilla JavaScript**: Interactive features
- **Font Awesome**: Icon library
- **Google Fonts**: Typography

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **PostgreSQL**: Database
- **Prisma**: ORM and database toolkit
- **JWT**: Authentication
- **Zod**: Input validation
- **Winston**: Logging

## 🔐 Security Considerations

- **Environment Variables**: Never commit `.env` files
- **API Keys**: Store all sensitive data in environment variables
- **Database**: Use strong passwords and secure connections
- **Authentication**: Implement proper JWT handling and refresh tokens
- **Input Validation**: Validate all user inputs
- **Rate Limiting**: Prevent brute force attacks
- **File Uploads**: Validate file types and sizes

## 📞 Contact

For support and inquiries:
- **Email**: darulaman.cox@gmail.com
- **Phone**: +8801729-872581
- **Address**: South Sahittika Palli, Darul Aman Road, B.G.B Camp, Ward No. 06, Cox's Bazar

## 📄 License

This project is licensed under the terms specified in the LICENSE.txt file.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📚 Additional Documentation

- **Backend Documentation**: See `backend/README.md` for detailed API documentation
- **Database Schema**: Check `backend/prisma/schema.prisma` for database structure
- **Portal Usage**: Refer to individual portal dashboard pages for usage instructions

---

**Darul Aman Academy** — Excellence in Islamic Education 🌟