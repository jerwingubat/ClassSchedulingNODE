# Class Scheduling System - Node.js/Express Backend

A comprehensive class scheduling system migrated from client-side JavaScript to a Node.js/Express.js backend with Firebase Firestore database.

## Features

- **Department Management**: Create and manage multiple departments
- **Teacher Management**: Add, edit, and delete teachers with weekly hour calculations
- **Subject Management**: Manage subjects with different unit configurations (1, 3, 4 units)
- **Room Management**: Handle lecture and laboratory rooms
- **Schedule Generation**: Advanced genetic algorithm for optimal schedule generation
- **Bulk Import**: Import multiple subjects and teachers via text format
- **Print Support**: Generate printable schedules for individual teachers
- **Real-time Updates**: Firebase Firestore integration for real-time data synchronization

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: Firebase Firestore
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Joi
- **Environment**: dotenv

## Prerequisites

- Node.js (v14 or higher)
- Firebase project with Firestore enabled
- Firebase service account key

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ClassSchedulingNODE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Go to your Firebase Console
   - Create a new project or use existing one
   - Enable Firestore Database
   - Go to Project Settings > Service Accounts
   - Generate a new private key (JSON file)
   - Copy the service account credentials

4. **Environment Configuration**
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Firebase Configuration
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY_ID=your-private-key-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
   FIREBASE_CLIENT_ID=your-client-id
   FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
   FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
   FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
   FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # CORS Configuration
   CORS_ORIGIN=http://localhost:3000
   ```

5. **Firestore Security Rules**
   Update your Firestore security rules to allow read/write access:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true; // For development only
       }
     }
   }
   ```

## Usage

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

3. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## API Endpoints

### Teachers
- `GET /api/teachers` - Get all teachers (optional: ?department=dept)
- `GET /api/teachers/:id` - Get specific teacher
- `POST /api/teachers` - Create new teacher
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher
- `GET /api/teachers/:id/weekly-hours` - Get teacher's weekly hours

### Subjects
- `GET /api/subjects` - Get all subjects (optional: ?department=dept)
- `GET /api/subjects/:id` - Get specific subject
- `POST /api/subjects` - Create new subject
- `PUT /api/subjects/:id` - Update subject
- `DELETE /api/subjects/:id` - Delete subject
- `POST /api/subjects/bulk-import` - Bulk import subjects
- `GET /api/subjects/teacher/:teacherId` - Get subjects by teacher

### Departments
- `GET /api/departments` - Get all departments
- `GET /api/departments/:id` - Get specific department
- `POST /api/departments` - Create new department
- `PUT /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Delete department

### Rooms
- `GET /api/rooms` - Get all rooms (optional: ?department=dept)
- `GET /api/rooms/:id` - Get specific room
- `POST /api/rooms` - Create new room
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room
- `GET /api/rooms/type/:type` - Get rooms by type (lecture/laboratory)

### Schedules
- `GET /api/schedules` - Get all schedules (optional: ?department=dept)
- `GET /api/schedules/teacher/:teacherId` - Get schedule by teacher
- `POST /api/schedules/generate` - Generate new schedule
- `DELETE /api/schedules` - Delete all schedules for department

### Health Check
- `GET /api/health` - Server health status

## Data Models

### Teacher
```javascript
{
  id: string,
  name: string,
  department: string,
  createdAt: string,
  updatedAt: string
}
```

### Subject
```javascript
{
  id: string,
  name: string,
  section: string,
  units: number, // 1, 3, or 4
  teacherId: string,
  department: string,
  students: number,
  createdAt: string,
  updatedAt: string
}
```

### Department
```javascript
{
  id: string,
  name: string,
  createdAt: string,
  updatedAt: string
}
```

### Room
```javascript
{
  id: string,
  name: string,
  type: string, // "lecture" or "laboratory"
  department: string,
  createdAt: string,
  updatedAt: string
}
```

### Schedule Allocation
```javascript
{
  subjectId: string,
  teacherId: string,
  type: string, // "lecture" or "laboratory"
  day: string, // "Mon", "Tue", "Wed", "Thu", "Fri"
  startHour: number,
  duration: number,
  roomId: string,
  subjectName: string,
  section: string,
  teacherName: string,
  roomName: string,
  department: string,
  unscheduled: boolean
}
```

## Bulk Import Format

The bulk import feature accepts text in the following format:
```
Teacher Name: Subject Name @ Section - Units - Students; Another Subject @ Section - Units - Students
Another Teacher: Subject Name @ Section - Units - Students
```

Example:
```
John Doe: Data Structures @ BSCS-1A - 3u - 30; Algorithms @ BSCS-1B - 3u - 25
Jane Smith: Database Systems @ BSCS-2A - 3u - 28
```

## Scheduling Algorithm

The system uses a genetic algorithm for optimal schedule generation:

1. **Initial Population**: Creates initial schedule using greedy algorithm
2. **Fitness Evaluation**: Evaluates schedules based on:
   - Teacher conflicts
   - Room conflicts
   - Subject distribution
   - Workload balance
   - Friday scheduling preferences
3. **Selection**: Tournament selection for parent selection
4. **Crossover**: One-point crossover for creating offspring
5. **Mutation**: Random mutation of time slots and rooms
6. **Evolution**: Iterates through generations to find optimal solution

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing configuration
- **Rate Limiting**: API request rate limiting
- **Input Validation**: Joi schema validation
- **Error Handling**: Comprehensive error handling middleware

## Development

### Project Structure
```
├── config/
│   └── firebase.js          # Firebase configuration
├── routes/
│   ├── teachers.js          # Teacher API routes
│   ├── subjects.js          # Subject API routes
│   ├── departments.js       # Department API routes
│   ├── rooms.js             # Room API routes
│   └── schedules.js         # Schedule API routes
├── utils/
│   ├── scheduling.js        # Scheduling algorithms
│   └── helpers.js           # Utility functions
├── public/
│   ├── index.html           # Main HTML file
│   ├── styles.css           # CSS styles
│   ├── js/
│   │   └── api.js           # API client
│   └── app-new.js           # Frontend application
├── server.js                # Express server
├── package.json             # Dependencies
└── README.md                # Documentation
```

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (not implemented yet)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support and questions, please open an issue in the repository.