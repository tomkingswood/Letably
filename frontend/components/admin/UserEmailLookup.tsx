'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { users } from '@/lib/api';
import Input from '@/components/ui/Input';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: string;
}

export interface UserData {
  userId: number | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  isNewUser: boolean;
  sendWelcomeEmail: boolean;
}

interface UserEmailLookupProps {
  onUserChange: (data: UserData) => void;
  phoneRequired?: boolean;
  initialEmail?: string;
  label?: string;
  disabled?: boolean;
  /** Shows an Add button instead of continuous callbacks. Use when building a list of users. */
  showAddButton?: boolean;
  /** Callback when Add button is clicked. Required if showAddButton is true. */
  onUserAdd?: (data: UserData) => void;
  /** Text for the Add button (default: "Add") */
  addButtonText?: string;
}

export default function UserEmailLookup({
  onUserChange,
  phoneRequired = false,
  initialEmail = '',
  label = 'Tenant',
  disabled = false,
  showAddButton = false,
  onUserAdd,
  addButtonText = 'Add',
}: UserEmailLookupProps) {
  const [email, setEmail] = useState(initialEmail);
  const [lookupState, setLookupState] = useState<'idle' | 'checking' | 'found' | 'not_found'>('idle');
  const [existingUser, setExistingUser] = useState<User | null>(null);
  const [newUserData, setNewUserData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Reset the component to initial state
  const resetComponent = useCallback(() => {
    setEmail('');
    setLookupState('idle');
    setExistingUser(null);
    setNewUserData({ firstName: '', lastName: '', phone: '' });
  }, []);

  // Handle adding user in multi-user mode
  const handleAddUser = useCallback(() => {
    if (!onUserAdd) return;

    if (lookupState === 'found' && existingUser) {
      // Existing user
      onUserAdd({
        userId: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.first_name,
        lastName: existingUser.last_name,
        phone: existingUser.phone || '',
        isNewUser: false,
        sendWelcomeEmail: false,
      });
      resetComponent();
    } else if (lookupState === 'not_found' && newUserData.firstName && newUserData.lastName) {
      // New user
      onUserAdd({
        userId: null,
        email,
        firstName: newUserData.firstName,
        lastName: newUserData.lastName,
        phone: newUserData.phone,
        isNewUser: true,
        sendWelcomeEmail: true,
      });
      resetComponent();
    }
  }, [lookupState, existingUser, newUserData, email, onUserAdd, resetComponent]);

  // Check if user can be added (for multi-user mode button state)
  const canAddUser = (lookupState === 'found' && existingUser) ||
    (lookupState === 'not_found' && newUserData.firstName && newUserData.lastName);

  // Generate unique ID for form elements to avoid collisions with multiple instances
  const instanceId = useRef(`user-lookup-${Math.random().toString(36).substr(2, 9)}`);

  // Use ref to store callback to avoid infinite loops
  const onUserChangeRef = useRef(onUserChange);
  onUserChangeRef.current = onUserChange;

  // Email validation
  const isValidEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  // Lookup user by email
  const lookupUser = useCallback(async (emailToCheck: string) => {
    if (!isValidEmail(emailToCheck)) {
      setLookupState('idle');
      setExistingUser(null);
      return;
    }

    setLookupState('checking');

    try {
      const response = await users.lookupByEmail(emailToCheck);

      if (response.data.exists && response.data.user) {
        setExistingUser(response.data.user);
        setLookupState('found');

        // Notify parent of existing user
        onUserChangeRef.current({
          userId: response.data.user.id,
          email: response.data.user.email,
          firstName: response.data.user.first_name,
          lastName: response.data.user.last_name,
          phone: response.data.user.phone || '',
          isNewUser: false,
          sendWelcomeEmail: false,
        });
      } else {
        setExistingUser(null);
        setLookupState('not_found');
      }
    } catch (error) {
      console.error('Error looking up user:', error);
      setLookupState('idle');
    }
  }, []);

  // Handle email input change with debounce
  const handleEmailChange = (newEmail: string) => {
    setEmail(newEmail);

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Reset state if email is cleared or invalid
    if (!newEmail || !isValidEmail(newEmail)) {
      setLookupState('idle');
      setExistingUser(null);
      return;
    }

    // Set new timer for 500ms debounce
    const timer = setTimeout(() => {
      lookupUser(newEmail);
    }, 500);

    setDebounceTimer(timer);
  };

  // Update parent when new user data changes
  useEffect(() => {
    if (lookupState === 'not_found') {
      onUserChangeRef.current({
        userId: null,
        email,
        firstName: newUserData.firstName,
        lastName: newUserData.lastName,
        phone: newUserData.phone,
        isNewUser: true,
        sendWelcomeEmail: true,
      });
    }
  }, [newUserData, lookupState, email]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  return (
    <div className="space-y-4">
      {/* Email Input */}
      <div>
        <Input
          label={`${label} Email Address`}
          type="email"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          placeholder="Enter email address..."
          disabled={disabled}
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          We'll check if this email already has an account. If not, we'll create one.
        </p>

        {/* Status indicator */}
        {lookupState === 'checking' && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Checking...
          </div>
        )}
      </div>

      {/* Existing User Found */}
      {lookupState === 'found' && existingUser && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-green-800">Account Found</h4>
              <p className="text-sm text-green-700 mt-1">
                This email is already registered. Their details will be used.
              </p>
              <div className="mt-3 bg-white rounded-md p-3 border border-green-200">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Name:</span>
                    <span className="ml-2 font-medium">{existingUser.first_name} {existingUser.last_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Role:</span>
                    <span className="ml-2 font-medium capitalize">{existingUser.role}</span>
                  </div>
                  {existingUser.phone && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Phone:</span>
                      <span className="ml-2 font-medium">{existingUser.phone}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Add button for multi-user mode */}
              {showAddButton && onUserAdd && (
                <button
                  type="button"
                  onClick={handleAddUser}
                  disabled={disabled}
                  className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                  {addButtonText}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New User Form */}
      {lookupState === 'not_found' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-800">New Account Required</h4>
              <p className="text-sm text-blue-700 mt-1">
                No account found for this email. Please enter their details below to create one.
              </p>
            </div>
          </div>

          <div className="space-y-4 bg-white rounded-md p-4 border border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={newUserData.firstName}
                onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                placeholder="Enter first name"
                required
                disabled={disabled}
              />
              <Input
                label="Last Name"
                value={newUserData.lastName}
                onChange={(e) => setNewUserData({ ...newUserData, lastName: e.target.value })}
                placeholder="Enter last name"
                required
                disabled={disabled}
              />
            </div>
            <Input
              label={`Phone Number${phoneRequired ? '' : ' (Optional)'}`}
              type="tel"
              value={newUserData.phone}
              onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
              placeholder="Enter phone number"
              required={phoneRequired}
              disabled={disabled}
            />

            <div className="pt-2 border-t border-gray-200">
              <p className="text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
                This person will receive an email with instructions to activate their account and set a password.
              </p>
            </div>

            {/* Add button for multi-user mode */}
            {showAddButton && onUserAdd && (
              <button
                type="button"
                onClick={handleAddUser}
                disabled={disabled || !newUserData.firstName || !newUserData.lastName}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                {addButtonText}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
