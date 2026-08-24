/**
 * Enumeration of all roles available in the system.
 */
export enum Role {
    //to manage presentation resources
    Presentations = "presentation:manage",
    // to create offers
    PresentationRequest = "presentation:request",
    // to manage issuance resources
    Issuances = "issuance:manage",
    // to create offers
    IssuanceOffer = "issuance:offer",
    // to manage client resources
    Clients = "clients:manage",
    // to manage human users
    Users = "users:manage",
    // to manage tenant resources
    Tenants = "tenants:manage",
    // to manage the current tenant's full configuration
    TenantAdmin = "tenant:admin",
    // to manage registrar configuration and operations
    Registrar = "registrar:manage",
}

/**
 * List of all roles
 */
export const allRoles = [
    Role.Tenants,
    Role.IssuanceOffer,
    Role.Issuances,
    Role.PresentationRequest,
    Role.Presentations,
    Role.Clients,
    Role.Users,
    Role.Registrar,
    Role.TenantAdmin,
];
