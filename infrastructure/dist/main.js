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
const certificateArn = app.node.tryGetContext('certificateArn');
// Hostname the CRM calls. Deploy HTTP-only (scratch environments) with
// `-c domainName=""`; anything serving real traffic must keep a domain so the
// ALB terminates TLS — CRM forwards caller JWTs to this API.
const domainNameContext = app.node.tryGetContext('domainName');
const domainName = domainNameContext === undefined
    ? 'profiles-api.pashkovsky-group.com'
    : domainNameContext || undefined;
new profiles_api_stack_1.ProfilesApiStack(app, 'ProfilesApiStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'eu-north-1',
    },
    description: 'NestJS Profiles API on ECS Fargate',
    secretsArn,
    secretsName,
    domainName,
    certificateArn,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFvQztBQUNwQyxpREFBa0M7QUFDbEMsNkRBQXVEO0FBRXZELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFBO0FBRXpCLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBdUIsQ0FBQTtBQUM3RSxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQXVCLENBQUE7QUFDL0UsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQXVCLENBQUE7QUFFckYsdUVBQXVFO0FBQ3ZFLDhFQUE4RTtBQUM5RSw2REFBNkQ7QUFDN0QsTUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQXVCLENBQUE7QUFDcEYsTUFBTSxVQUFVLEdBQ2QsaUJBQWlCLEtBQUssU0FBUztJQUM3QixDQUFDLENBQUMsbUNBQW1DO0lBQ3JDLENBQUMsQ0FBQyxpQkFBaUIsSUFBSSxTQUFTLENBQUE7QUFFcEMsSUFBSSxxQ0FBZ0IsQ0FBQyxHQUFHLEVBQUUsa0JBQWtCLEVBQUU7SUFDNUMsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFlBQVk7S0FDdkQ7SUFDRCxXQUFXLEVBQUUsb0NBQW9DO0lBQ2pELFVBQVU7SUFDVixXQUFXO0lBQ1gsVUFBVTtJQUNWLGNBQWM7Q0FDZixDQUFDLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3RlcidcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYidcbmltcG9ydCB7IFByb2ZpbGVzQXBpU3RhY2sgfSBmcm9tICcuL3Byb2ZpbGVzLWFwaS1zdGFjaydcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKVxuXG5jb25zdCBzZWNyZXRzQXJuID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnc2VjcmV0c0FybicpIGFzIHN0cmluZyB8IHVuZGVmaW5lZFxuY29uc3Qgc2VjcmV0c05hbWUgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzZWNyZXRzTmFtZScpIGFzIHN0cmluZyB8IHVuZGVmaW5lZFxuY29uc3QgY2VydGlmaWNhdGVBcm4gPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdjZXJ0aWZpY2F0ZUFybicpIGFzIHN0cmluZyB8IHVuZGVmaW5lZFxuXG4vLyBIb3N0bmFtZSB0aGUgQ1JNIGNhbGxzLiBEZXBsb3kgSFRUUC1vbmx5IChzY3JhdGNoIGVudmlyb25tZW50cykgd2l0aFxuLy8gYC1jIGRvbWFpbk5hbWU9XCJcImA7IGFueXRoaW5nIHNlcnZpbmcgcmVhbCB0cmFmZmljIG11c3Qga2VlcCBhIGRvbWFpbiBzbyB0aGVcbi8vIEFMQiB0ZXJtaW5hdGVzIFRMUyDigJQgQ1JNIGZvcndhcmRzIGNhbGxlciBKV1RzIHRvIHRoaXMgQVBJLlxuY29uc3QgZG9tYWluTmFtZUNvbnRleHQgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdkb21haW5OYW1lJykgYXMgc3RyaW5nIHwgdW5kZWZpbmVkXG5jb25zdCBkb21haW5OYW1lID1cbiAgZG9tYWluTmFtZUNvbnRleHQgPT09IHVuZGVmaW5lZFxuICAgID8gJ3Byb2ZpbGVzLWFwaS5wYXNoa292c2t5LWdyb3VwLmNvbSdcbiAgICA6IGRvbWFpbk5hbWVDb250ZXh0IHx8IHVuZGVmaW5lZFxuXG5uZXcgUHJvZmlsZXNBcGlTdGFjayhhcHAsICdQcm9maWxlc0FwaVN0YWNrJywge1xuICBlbnY6IHtcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICdldS1ub3J0aC0xJyxcbiAgfSxcbiAgZGVzY3JpcHRpb246ICdOZXN0SlMgUHJvZmlsZXMgQVBJIG9uIEVDUyBGYXJnYXRlJyxcbiAgc2VjcmV0c0FybixcbiAgc2VjcmV0c05hbWUsXG4gIGRvbWFpbk5hbWUsXG4gIGNlcnRpZmljYXRlQXJuLFxufSlcbiJdfQ==