#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const profiles_api_stack_1 = require("./profiles-api-stack");
const app = new cdk.App();
const secretsArn = app.node.tryGetContext('secretsArn');
const secretsName = app.node.tryGetContext('secretsName');
new profiles_api_stack_1.ProfilesApiStack(app, 'ProfilesApiStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'eu-north-1',
    },
    description: 'NestJS Profiles API on ECS Fargate',
    secretsArn,
    secretsName,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFvQztBQUNwQyxpREFBa0M7QUFDbEMsNkRBQXVEO0FBRXZELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFBO0FBRXpCLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBdUIsQ0FBQTtBQUM3RSxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQXVCLENBQUE7QUFFL0UsSUFBSSxxQ0FBZ0IsQ0FBQyxHQUFHLEVBQUUsa0JBQWtCLEVBQUU7SUFDNUMsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFlBQVk7S0FDdkQ7SUFDRCxXQUFXLEVBQUUsb0NBQW9DO0lBQ2pELFVBQVU7SUFDVixXQUFXO0NBQ1osQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInXG5pbXBvcnQgeyBQcm9maWxlc0FwaVN0YWNrIH0gZnJvbSAnLi9wcm9maWxlcy1hcGktc3RhY2snXG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKClcblxuY29uc3Qgc2VjcmV0c0FybiA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3NlY3JldHNBcm4nKSBhcyBzdHJpbmcgfCB1bmRlZmluZWRcbmNvbnN0IHNlY3JldHNOYW1lID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnc2VjcmV0c05hbWUnKSBhcyBzdHJpbmcgfCB1bmRlZmluZWRcblxubmV3IFByb2ZpbGVzQXBpU3RhY2soYXBwLCAnUHJvZmlsZXNBcGlTdGFjaycsIHtcbiAgZW52OiB7XG4gICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAnZXUtbm9ydGgtMScsXG4gIH0sXG4gIGRlc2NyaXB0aW9uOiAnTmVzdEpTIFByb2ZpbGVzIEFQSSBvbiBFQ1MgRmFyZ2F0ZScsXG4gIHNlY3JldHNBcm4sXG4gIHNlY3JldHNOYW1lLFxufSlcbiJdfQ==