import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Inject,
    Param,
    Patch,
    Post,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "../roles/role.enum";
import { Secured } from "../secure.decorator";
import { requireTenantContext } from "../tenant-context.util";
import { Token, TokenPayload } from "../token.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { ManagedUserDto } from "./dto/managed-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { USERS_PROVIDER, UsersProvider } from "./user.provider";

@ApiTags("User")
@Controller("user")
export class UserController {
    constructor(
        @Inject(USERS_PROVIDER) private readonly users: UsersProvider,
    ) {}

    @ApiOperation({ summary: "Get all managed users for the current tenant" })
    @ApiResponse({ status: 200, type: ManagedUserDto, isArray: true })
    @Secured([Role.Users])
    @Get()
    getUsers(@Token() user: TokenPayload) {
        const tenantId = requireTenantContext(user);
        return this.users.getUsers(tenantId);
    }

    @ApiOperation({ summary: "Get a managed user by id" })
    @ApiResponse({ status: 200, type: ManagedUserDto })
    @Secured([Role.Users])
    @Get(":id")
    getUser(@Param("id") id: string, @Token() user: TokenPayload) {
        const tenantId = requireTenantContext(user);
        return this.users.getUser(tenantId, id);
    }

    @ApiOperation({ summary: "Create a new managed user" })
    @ApiBody({ type: CreateUserDto })
    @ApiResponse({ status: 201, type: ManagedUserDto })
    @Secured([Role.Users])
    @Post()
    createUser(
        @Body() createUserDto: CreateUserDto,
        @Token() user: TokenPayload,
    ) {
        const tenantId = requireTenantContext(user);
        if (
            createUserDto.roles?.includes(Role.Tenants) &&
            !user.roles.includes(Role.Tenants)
        ) {
            throw new ForbiddenException(
                "Cannot assign tenant:manage role without having tenant:manage privileges",
            );
        }

        return this.users.addUser(tenantId, createUserDto);
    }

    @ApiOperation({ summary: "Update a managed user" })
    @ApiBody({ type: UpdateUserDto })
    @ApiResponse({ status: 200, type: ManagedUserDto })
    @Secured([Role.Users])
    @Patch(":id")
    updateUser(
        @Param("id") id: string,
        @Body() updateUserDto: UpdateUserDto,
        @Token() user: TokenPayload,
    ) {
        const tenantId = requireTenantContext(user);
        if (
            updateUserDto.roles?.includes(Role.Tenants) &&
            !user.roles.includes(Role.Tenants)
        ) {
            throw new ForbiddenException(
                "Cannot assign tenant:manage role without having tenant:manage privileges",
            );
        }

        return this.users.updateUser(tenantId, id, updateUserDto);
    }

    @ApiOperation({ summary: "Delete a managed user" })
    @ApiResponse({ status: 200 })
    @Secured([Role.Users])
    @Delete(":id")
    deleteUser(@Param("id") id: string, @Token() user: TokenPayload) {
        const tenantId = requireTenantContext(user);
        return this.users.removeUser(tenantId, id);
    }
}
