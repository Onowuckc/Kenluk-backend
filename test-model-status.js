import mongoose from 'mongoose';
import FidelityPayment from './src/models/FidelityPayment.js';

// Connect to MongoDB (using the same connection as the app)
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kenluk';
        await mongoose.connect(mongoURI);
        console.log('MongoDB connected for testing');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const testStatusEnum = async () => {
    try {
        await connectDB();

        // Test creating a payment with InvoiceSent status
        const testPayment = new FidelityPayment({
            transactionRef: 'TEST-123456789',
            requestRef: 'REQ-TEST-123456789',
            userId: new mongoose.Types.ObjectId(), // Dummy ObjectId
            amount: 10000, // 100 NGN in kobo
            currency: 'NGN',
            description: 'Test payment',
            customer: {
                firstName: 'Test',
                lastName: 'User',
                email: 'test@example.com',
                phone: '2348012345678'
            },
            status: 'InvoiceSent' // Test the new status
        });

        // Try to validate the model
        await testPayment.validate();
        console.log('✅ InvoiceSent status is now valid in the model!');

        // Clean up - don't actually save to DB
        console.log('Test completed successfully - InvoiceSent status is accepted.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB disconnected');
    }
};

testStatusEnum();
