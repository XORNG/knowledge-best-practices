---
title: TypeScript Best Practices
language: typescript
version: "1.0"
---

# TypeScript Best Practices

A comprehensive guide to writing clean, maintainable TypeScript code.

## Use explicit return types for public functions

All exported functions and public class methods should have explicit return types. This improves documentation, catches refactoring errors, and provides better IDE support.

Good:
```typescript
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

export class UserService {
  async getUser(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }
}
```

Bad:
```typescript
export function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### Rationale

Without explicit return types, a simple refactoring can accidentally change the return type and break consuming code without any compile-time error.

Related lint rules: @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types

## Prefer interfaces over type aliases for object shapes

Use interfaces for object types that will be extended or implemented. Use type aliases for unions, intersections, and primitive aliases.

Good:
```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

interface AdminUser extends User {
  permissions: string[];
}

type UserId = string;
type UserOrAdmin = User | AdminUser;
```

Bad:
```typescript
type User = {
  id: string;
  name: string;
  email: string;
};
```

### Rationale

Interfaces can be extended and merged, provide better error messages, and are generally more performant for the TypeScript compiler.

## Use strict null checks

Always enable `strictNullChecks` in tsconfig.json and handle null/undefined explicitly.

Good:
```typescript
function getUser(id: string): User | null {
  const user = users.get(id);
  return user ?? null;
}

const user = getUser('123');
if (user) {
  console.log(user.name); // TypeScript knows user is not null
}
```

Bad:
```typescript
function getUser(id: string): User {
  return users.get(id); // Might be undefined!
}
```

### Rationale

Strict null checks catch a large class of runtime errors at compile time.

## Use const assertions for literal types

Use `as const` for objects and arrays that should have literal types and be readonly.

Good:
```typescript
const ROLES = ['admin', 'user', 'guest'] as const;
type Role = typeof ROLES[number]; // 'admin' | 'user' | 'guest'

const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
} as const;
```

Bad:
```typescript
const ROLES = ['admin', 'user', 'guest'];
type Role = string; // Too broad!
```

## Prefer unknown over any

Use `unknown` for values of unknown type that need type checking before use. Use `any` only as a last resort.

Good:
```typescript
function processValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.toUpperCase();
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  throw new Error('Unsupported type');
}
```

Bad:
```typescript
function processValue(value: any): string {
  return value.toUpperCase(); // Runtime error if not a string!
}
```

Related lint rules: @typescript-eslint/no-explicit-any

## Use discriminated unions for state management

Use discriminated unions with a shared discriminant property for complex state types.

Good:
```typescript
type LoadingState = { status: 'loading' };
type SuccessState<T> = { status: 'success'; data: T };
type ErrorState = { status: 'error'; error: Error };

type AsyncState<T> = LoadingState | SuccessState<T> | ErrorState;

function render(state: AsyncState<User>): string {
  switch (state.status) {
    case 'loading':
      return 'Loading...';
    case 'success':
      return `Hello, ${state.data.name}`;
    case 'error':
      return `Error: ${state.error.message}`;
  }
}
```

Bad:
```typescript
interface State<T> {
  loading: boolean;
  data?: T;
  error?: Error;
}
```

### Rationale

Discriminated unions ensure exhaustive checking and prevent impossible states.
