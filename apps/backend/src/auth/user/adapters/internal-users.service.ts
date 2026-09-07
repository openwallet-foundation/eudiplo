import { Injectable, NotImplementedException } from "@nestjs/common";
import { ManagedUserDto } from "../dto/managed-user.dto.js";
import type { CreateUser, UpdateUser } from "../schemas/create-user.schema.js";
import { UsersProvider } from "../user.provider.js";

@Injectable()
export class InternalUsersProvider extends UsersProvider {
    private unsupported(): never {
        throw new NotImplementedException(
            "Human user management is only available when EUDIPLO is configured with an external OIDC provider.",
        );
    }

    getUsers(_tenantId: string): Promise<ManagedUserDto[]> {
        this.unsupported();
    }

    getUser(_tenantId: string, _userId: string): Promise<ManagedUserDto> {
        this.unsupported();
    }

    addUser(_tenantId: string, _dto: CreateUser): Promise<ManagedUserDto> {
        this.unsupported();
    }

    updateUser(
        _tenantId: string,
        _userId: string,
        _dto: UpdateUser,
    ): Promise<ManagedUserDto> {
        this.unsupported();
    }

    removeUser(_tenantId: string, _userId: string): Promise<void> {
        this.unsupported();
    }
}
