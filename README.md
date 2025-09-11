# searoutes

A modern ES6 Node.js module for sea route calculations with full TypeScript support.

## Installation

```bash
npm install searoutes
```

## Usage

### TypeScript (Recommended)

```typescript
import { greet, SeaRoute, type RouteInfo } from 'searoutes';

// Type-safe usage with full IntelliSense support
const message: string = greet('Captain');
console.log(message); // "Hello, Captain! Welcome to searoutes."

// Using the SeaRoute class with full type inference
const route: SeaRoute = new SeaRoute('Hamburg', 'New York', 3500);
const info: RouteInfo = route.getRouteInfo();
console.log(info);

const estimatedTime: number = route.calculateTime(20); // 20 knots
console.log(`Estimated time: ${estimatedTime} hours`);
```

### ES6 Modules (JavaScript)

```javascript
import { greet, SeaRoute } from 'searoutes';
// or
import searoutes from 'searoutes';

// Using named exports
const message = greet('Captain');
console.log(message); // "Hello, Captain! Welcome to searoutes."

// Using the SeaRoute class
const route = new SeaRoute('Hamburg', 'New York', 3500);
const info = route.getRouteInfo();
console.log(info);

const estimatedTime = route.calculateTime(20); // 20 knots
console.log(`Estimated time: ${estimatedTime} hours`);
```

### CommonJS (Node.js compatibility)

```javascript
const { greet, SeaRoute } = require('searoutes');

const route = new SeaRoute('London', 'Boston', 3000);
console.log(route.getRouteInfo());
```

## TypeScript Support

This module includes full TypeScript declarations and type definitions. No additional `@types` package is needed.

### Available Types

```typescript
// Import types for use in your TypeScript code
import type { RouteInfo, SearchRoutesModule } from 'searoutes';

// RouteInfo type
interface RouteInfo {
  from: string;
  to: string;
  distance: number;
  description: string;
}

// All exports are fully typed
const route = new SeaRoute('A', 'B', 100); // SeaRoute instance
const info = route.getRouteInfo(); // RouteInfo type
const time = route.calculateTime(15); // number type
```

### Type Checking

The module supports strict TypeScript checking and will provide compile-time errors for incorrect usage:

```typescript
// ✅ Correct usage
const message = greet('Hello');

// ❌ TypeScript error - argument must be string
const invalid = greet(123);

// ✅ Correct usage  
const route = new SeaRoute('A', 'B', 500);

// ❌ TypeScript error - speed must be positive number
const time = route.calculateTime(-10);
```

## API

### `greet(name)`

Returns a greeting message.

- **name** (string): The name to greet
- **Returns**: string - A greeting message
- **Throws**: Error if name is not a string

### `SeaRoute`

A class representing a sea route between two points.

#### Constructor

```javascript
new SeaRoute(from, to, distance = 0)
```

- **from** (string): Starting point
- **to** (string): Destination point  
- **distance** (number): Distance in nautical miles (default: 0)

#### Methods

##### `getRouteInfo()`

Returns route information object.

**Returns**: Object with properties:
- `from`: Starting point
- `to`: Destination  
- `distance`: Distance in nautical miles
- `description`: Human-readable route description

##### `calculateTime(speed = 10)`

Calculates estimated travel time.

- **speed** (number): Speed in knots (default: 10)
- **Returns**: number - Estimated time in hours
- **Throws**: Error if speed is not positive

## Development

### Setup

```bash
git clone <repository-url>
cd searoutes
npm install
```

### Scripts

- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run build` - Build for production
- `npm run build:watch` - Build in watch mode
- `npm start` - Run the module

### Testing

This project uses Mocha and Chai for testing. Tests are located in the `test/` directory.

```bash
npm test
```

### Linting

ESLint is configured for modern JavaScript standards:

```bash
npm run lint
```

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Requirements

- Node.js >= 16.0.0
