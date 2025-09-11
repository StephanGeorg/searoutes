/**
 * TypeScript usage examples for searoutes module
 * This file demonstrates how to use the module in TypeScript projects
 */
import { greet, SeaRoute, type RouteInfo, type SearchRoutesModule } from '../src/index.js';
// or
// import searoutes from '../src/index.js';

// Example 1: Using the greet function with type safety
const message: string = greet('TypeScript Developer');
console.log(message);

// This would cause a TypeScript error:
// const invalidMessage = greet(123); // Error: Argument of type 'number' is not assignable to parameter of type 'string'

// Example 2: Using the SeaRoute class with full type inference
const route: SeaRoute = new SeaRoute('Hamburg', 'New York', 3500);

// TypeScript infers the return type as RouteInfo
const routeInfo: RouteInfo = route.getRouteInfo();
console.log(`Route: ${routeInfo.description}`);
console.log(`Distance: ${routeInfo.distance} nautical miles`);

// TypeScript infers the return type as number
const travelTime: number = route.calculateTime(20);
console.log(`Estimated travel time: ${travelTime} hours`);

// Example 3: Using types explicitly
const createRoute = (from: string, to: string, distance: number): SeaRoute => {
  return new SeaRoute(from, to, distance);
};

const processRouteInfo = (info: RouteInfo): void => {
  console.log(`Processing route from ${info.from} to ${info.to}`);
};

// Example 4: Using the default export with full typing
const handleModule = (module: SearchRoutesModule): void => {
  const greeting = module.greet('Captain');
  const route = new module.SeaRoute('London', 'Boston', 3000);
  console.log(`Module version: ${module.version}`);
};

export {
  message,
  route,
  routeInfo,
  travelTime,
  createRoute,
  processRouteInfo,
  handleModule
};
