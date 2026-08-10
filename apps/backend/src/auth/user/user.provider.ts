import { ManagedUserDto } from "./dto/managed-user.dto";
import type { CreateUser, UpdateUser } from "./schemas/create-user.schema";

export const USERS_PROVIDER = "USERS_PROVIDER";

export abstract class UsersProvider {
    abstract getUsers(tenantId: string): Promise<ManagedUserDto[]>;

    abstract getUser(tenantId: string, userId: string): Promise<ManagedUserDto>;

    abstract addUser(
        tenantId: string,
        dto: CreateUser,
    ): Promise<ManagedUserDto>;

    abstract updateUser(
        tenantId: string,
        userId: string,
        dto: UpdateUser,
    ): Promise<ManagedUserDto>;

    abstract removeUser(tenantId: string, userId: string): Promise<void>;
}
