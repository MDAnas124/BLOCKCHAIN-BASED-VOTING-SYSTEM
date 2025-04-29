const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Voter = require('./models/Voter');
const Election = require('./models/Election');
const Candidate = require('./models/Candidate');

// Sample data
const voters = [
    {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@evoting.com',
        password: 'admin@123',
        studentId: 'ADMIN001',
        department: 'Administration',
        role: 'admin',
        isVerified: true,
        walletAddress: '0x0000000000000000000000000000000000000000'
    },
    {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@student.com',
        password: 'student123',
        studentId: 'STU001',
        department: 'CSE',
        role: 'student',
        isVerified: true,
        walletAddress: '0x0000000000000000000000000000000000000001'
    }
];

const elections = [
    {
        title: 'Student Council President 2025',
        description: 'Election for the position of Student Council President',
        startDate: new Date('2025-03-01'),
        endDate: new Date('2025-03-07'),
        department: ['All'],
        status: 'upcoming',
        isActive: true
    },
    {
        title: 'Department Representative',
        description: 'Election for CSE Department Representative',
        startDate: new Date('2025-02-20'),
        endDate: new Date('2025-02-25'),
        department: ['CSE'],
        status: 'active',
        isActive: true
    }
];

const candidates = [
    {
        name: 'Sarah Johnson',
        description: 'Third-year CSE student with leadership experience',
        electionId: null, // Will be set after election is created
        department: 'CSE',
        manifesto: 'Focusing on improving student facilities and academic resources',
        imageUrl: 'https://example.com/sarah.jpg',
        voteCount: 0
    },
    {
        name: 'Michael Chen',
        description: 'Fourth-year CSE student, current club president',
        electionId: null, // Will be set after election is created
        department: 'CSE',
        manifesto: 'Advocating for more practical learning opportunities',
        imageUrl: 'https://example.com/michael.jpg',
        voteCount: 0
    }
];

// Function to seed the database
async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/voting_system', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB for seeding');

        // Check if admin already exists
        const adminExists = await Voter.findOne({ email: 'admin@evoting.com' });
        if (adminExists) {
            console.log('Admin user already exists, skipping voter seeding');
        } else {
            // Clear existing data
            await Voter.deleteMany({});
            console.log('Cleared voters collection');

            // Hash passwords before inserting
            const hashedVoters = [];
            for (const voter of voters) {
                const hashedPassword = await bcrypt.hash(voter.password, 10);
                hashedVoters.push({
                    ...voter,
                    password: hashedPassword
                });
            }

            // Insert voters with hashed passwords
            await Voter.insertMany(hashedVoters);
            console.log('Voters seeded successfully');
        }

        // Check if elections already exist
        const electionCount = await Election.countDocuments();
        if (electionCount > 0) {
            console.log('Elections already exist, skipping election seeding');
        } else {
            // Clear existing elections
            await Election.deleteMany({});
            console.log('Cleared elections collection');

            // Insert elections
            await Election.insertMany(elections);
            console.log('Elections seeded successfully');
        }

        console.log('Database seeded successfully!');
        
        // Disconnect only if this script was run directly
        if (require.main === module) {
            await mongoose.disconnect();
            console.log('Disconnected from MongoDB after seeding');
        }

    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

// Run the seeding function
seedDatabase();
