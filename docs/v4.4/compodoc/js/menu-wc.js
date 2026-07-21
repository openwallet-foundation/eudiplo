'use strict';

customElements.define('compodoc-menu', class extends HTMLElement {
    constructor() {
        super();
        this.isNormalMode = this.getAttribute('mode') === 'normal';
    }

    connectedCallback() {
        this.render(this.isNormalMode);
    }

    render(isNormalMode) {
        let tp = lithtml.html(`
        <nav>
            <ul class="list">
                <li class="title">
                    <a href="index.html" data-type="index-link">@eudiplo/backend documentation</a>
                </li>

                <li class="divider"></li>
                ${ isNormalMode ? `<div id="book-search-input" role="search"><input type="text" placeholder="Type to search"></div>` : '' }
                <li class="chapter">
                    <a data-type="chapter-link" href="index.html"><span class="icon ion-ios-home"></span>Getting started</a>
                    <ul class="links">
                                <li class="link">
                                    <a href="index.html" data-type="chapter-link">
                                        <span class="icon ion-ios-keypad"></span>Overview
                                    </a>
                                </li>

                                <li class="link">
                                    <a href="dependencies.html" data-type="chapter-link">
                                        <span class="icon ion-ios-list"></span>Dependencies
                                    </a>
                                </li>
                                <li class="link">
                                    <a href="properties.html" data-type="chapter-link">
                                        <span class="icon ion-ios-apps"></span>Properties
                                    </a>
                                </li>

                    </ul>
                </li>
                    <li class="chapter modules">
                        <a data-type="chapter-link" href="modules.html">
                            <div class="menu-toggler linked" data-bs-toggle="collapse" ${ isNormalMode ?
                                'data-bs-target="#modules-links"' : 'data-bs-target="#xs-modules-links"' }>
                                <span class="icon ion-ios-archive"></span>
                                <span class="link-name">Modules</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                        </a>
                        <ul class="links collapse " ${ isNormalMode ? 'id="modules-links"' : 'id="xs-modules-links"' }>
                            <li class="link">
                                <a href="modules/AppModule.html" data-type="entity-link" >AppModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/AuditLogModule.html" data-type="entity-link" >AuditLogModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-AuditLogModule-c9d8b841b1baeaeb3adcb66a97502bdaa05eaec1cc8e830b4b22b13548a0c21580b4fd355700399f52caab5238a0ee3cfdfecfac08a178ef06be4491964c981f"' : 'data-bs-target="#xs-controllers-links-module-AuditLogModule-c9d8b841b1baeaeb3adcb66a97502bdaa05eaec1cc8e830b4b22b13548a0c21580b4fd355700399f52caab5238a0ee3cfdfecfac08a178ef06be4491964c981f"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AuditLogModule-c9d8b841b1baeaeb3adcb66a97502bdaa05eaec1cc8e830b4b22b13548a0c21580b4fd355700399f52caab5238a0ee3cfdfecfac08a178ef06be4491964c981f"' :
                                            'id="xs-controllers-links-module-AuditLogModule-c9d8b841b1baeaeb3adcb66a97502bdaa05eaec1cc8e830b4b22b13548a0c21580b4fd355700399f52caab5238a0ee3cfdfecfac08a178ef06be4491964c981f"' }>
                                            <li class="link">
                                                <a href="controllers/AuditLogController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuditLogController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AuditLogModule-c9d8b841b1baeaeb3adcb66a97502bdaa05eaec1cc8e830b4b22b13548a0c21580b4fd355700399f52caab5238a0ee3cfdfecfac08a178ef06be4491964c981f"' : 'data-bs-target="#xs-injectables-links-module-AuditLogModule-c9d8b841b1baeaeb3adcb66a97502bdaa05eaec1cc8e830b4b22b13548a0c21580b4fd355700399f52caab5238a0ee3cfdfecfac08a178ef06be4491964c981f"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AuditLogModule-c9d8b841b1baeaeb3adcb66a97502bdaa05eaec1cc8e830b4b22b13548a0c21580b4fd355700399f52caab5238a0ee3cfdfecfac08a178ef06be4491964c981f"' :
                                        'id="xs-injectables-links-module-AuditLogModule-c9d8b841b1baeaeb3adcb66a97502bdaa05eaec1cc8e830b4b22b13548a0c21580b4fd355700399f52caab5238a0ee3cfdfecfac08a178ef06be4491964c981f"' }>
                                        <li class="link">
                                            <a href="injectables/AuditLogService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuditLogService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/AuditLogModule.html" data-type="entity-link" >AuditLogModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AuditLogModule-89f632c05c92d47376dd6129df95040bd0fa99db9f455889f825947452abe73ffb66a842fa6fd239c1afdd3ad4d53a2cad4c851310007671d706fde2d6c06e68-1"' : 'data-bs-target="#xs-injectables-links-module-AuditLogModule-89f632c05c92d47376dd6129df95040bd0fa99db9f455889f825947452abe73ffb66a842fa6fd239c1afdd3ad4d53a2cad4c851310007671d706fde2d6c06e68-1"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AuditLogModule-89f632c05c92d47376dd6129df95040bd0fa99db9f455889f825947452abe73ffb66a842fa6fd239c1afdd3ad4d53a2cad4c851310007671d706fde2d6c06e68-1"' :
                                        'id="xs-injectables-links-module-AuditLogModule-89f632c05c92d47376dd6129df95040bd0fa99db9f455889f825947452abe73ffb66a842fa6fd239c1afdd3ad4d53a2cad4c851310007671d706fde2d6c06e68-1"' }>
                                        <li class="link">
                                            <a href="injectables/AuditLogService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuditLogService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/SessionLogStoreService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionLogStoreService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/SessionLoggerService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionLoggerService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/AuthModule.html" data-type="entity-link" >AuthModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-AuthModule-920a707af81e94d01e07461773c39b61c7f794be49e24c29db8c904fce44601d0d92f61ed99a5aa129adddf91f981ee28828625aef6671bca123abc48ddc02e4"' : 'data-bs-target="#xs-controllers-links-module-AuthModule-920a707af81e94d01e07461773c39b61c7f794be49e24c29db8c904fce44601d0d92f61ed99a5aa129adddf91f981ee28828625aef6671bca123abc48ddc02e4"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AuthModule-920a707af81e94d01e07461773c39b61c7f794be49e24c29db8c904fce44601d0d92f61ed99a5aa129adddf91f981ee28828625aef6671bca123abc48ddc02e4"' :
                                            'id="xs-controllers-links-module-AuthModule-920a707af81e94d01e07461773c39b61c7f794be49e24c29db8c904fce44601d0d92f61ed99a5aa129adddf91f981ee28828625aef6671bca123abc48ddc02e4"' }>
                                            <li class="link">
                                                <a href="controllers/AuthController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AuthModule-920a707af81e94d01e07461773c39b61c7f794be49e24c29db8c904fce44601d0d92f61ed99a5aa129adddf91f981ee28828625aef6671bca123abc48ddc02e4"' : 'data-bs-target="#xs-injectables-links-module-AuthModule-920a707af81e94d01e07461773c39b61c7f794be49e24c29db8c904fce44601d0d92f61ed99a5aa129adddf91f981ee28828625aef6671bca123abc48ddc02e4"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AuthModule-920a707af81e94d01e07461773c39b61c7f794be49e24c29db8c904fce44601d0d92f61ed99a5aa129adddf91f981ee28828625aef6671bca123abc48ddc02e4"' :
                                        'id="xs-injectables-links-module-AuthModule-920a707af81e94d01e07461773c39b61c7f794be49e24c29db8c904fce44601d0d92f61ed99a5aa129adddf91f981ee28828625aef6671bca123abc48ddc02e4"' }>
                                        <li class="link">
                                            <a href="injectables/AuthService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/JwtService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >JwtService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/JwtStrategy.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >JwtStrategy</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/ClientModule.html" data-type="entity-link" >ClientModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-ClientModule-abee04e577be194997373195e085ef434c19fc9b2baaa5367176dced185756db788640e197f0c74a654189d1b0726cd5bb89859e5c53a3f5203d9c528aa7703f"' : 'data-bs-target="#xs-controllers-links-module-ClientModule-abee04e577be194997373195e085ef434c19fc9b2baaa5367176dced185756db788640e197f0c74a654189d1b0726cd5bb89859e5c53a3f5203d9c528aa7703f"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-ClientModule-abee04e577be194997373195e085ef434c19fc9b2baaa5367176dced185756db788640e197f0c74a654189d1b0726cd5bb89859e5c53a3f5203d9c528aa7703f"' :
                                            'id="xs-controllers-links-module-ClientModule-abee04e577be194997373195e085ef434c19fc9b2baaa5367176dced185756db788640e197f0c74a654189d1b0726cd5bb89859e5c53a3f5203d9c528aa7703f"' }>
                                            <li class="link">
                                                <a href="controllers/ClientController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ClientController</a>
                                            </li>
                                        </ul>
                                    </li>
                            </li>
                            <li class="link">
                                <a href="modules/ConfigImportModule.html" data-type="entity-link" >ConfigImportModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-ConfigImportModule-062933d4eb6d6385f367a96e5813e48b10d74c88cda57856927f7494c6c23f3bce19e29815aee0b1b3b5c68670b001dba70cd6bc22ff97f26a069ce7e24c8885"' : 'data-bs-target="#xs-injectables-links-module-ConfigImportModule-062933d4eb6d6385f367a96e5813e48b10d74c88cda57856927f7494c6c23f3bce19e29815aee0b1b3b5c68670b001dba70cd6bc22ff97f26a069ce7e24c8885"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-ConfigImportModule-062933d4eb6d6385f367a96e5813e48b10d74c88cda57856927f7494c6c23f3bce19e29815aee0b1b3b5c68670b001dba70cd6bc22ff97f26a069ce7e24c8885"' :
                                        'id="xs-injectables-links-module-ConfigImportModule-062933d4eb6d6385f367a96e5813e48b10d74c88cda57856927f7494c6c23f3bce19e29815aee0b1b3b5c68670b001dba70cd6bc22ff97f26a069ce7e24c8885"' }>
                                        <li class="link">
                                            <a href="injectables/ConfigImportOrchestratorService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigImportOrchestratorService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ConfigImportService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigImportService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/ConfigurationModule.html" data-type="entity-link" >ConfigurationModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-ConfigurationModule-f57a49a6b5169480c1683d9249c41bf46db7c2934e14cd4d98f7c00d0e5ea9884bc594f3139b6576238d5f5f7b840ca1bffd13b7986f71878a605a2f749a777e"' : 'data-bs-target="#xs-controllers-links-module-ConfigurationModule-f57a49a6b5169480c1683d9249c41bf46db7c2934e14cd4d98f7c00d0e5ea9884bc594f3139b6576238d5f5f7b840ca1bffd13b7986f71878a605a2f749a777e"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-ConfigurationModule-f57a49a6b5169480c1683d9249c41bf46db7c2934e14cd4d98f7c00d0e5ea9884bc594f3139b6576238d5f5f7b840ca1bffd13b7986f71878a605a2f749a777e"' :
                                            'id="xs-controllers-links-module-ConfigurationModule-f57a49a6b5169480c1683d9249c41bf46db7c2934e14cd4d98f7c00d0e5ea9884bc594f3139b6576238d5f5f7b840ca1bffd13b7986f71878a605a2f749a777e"' }>
                                            <li class="link">
                                                <a href="controllers/AttributeProviderController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AttributeProviderController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/CredentialConfigController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CredentialConfigController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/IssuanceConfigController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >IssuanceConfigController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/WebhookEndpointController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >WebhookEndpointController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-ConfigurationModule-f57a49a6b5169480c1683d9249c41bf46db7c2934e14cd4d98f7c00d0e5ea9884bc594f3139b6576238d5f5f7b840ca1bffd13b7986f71878a605a2f749a777e"' : 'data-bs-target="#xs-injectables-links-module-ConfigurationModule-f57a49a6b5169480c1683d9249c41bf46db7c2934e14cd4d98f7c00d0e5ea9884bc594f3139b6576238d5f5f7b840ca1bffd13b7986f71878a605a2f749a777e"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-ConfigurationModule-f57a49a6b5169480c1683d9249c41bf46db7c2934e14cd4d98f7c00d0e5ea9884bc594f3139b6576238d5f5f7b840ca1bffd13b7986f71878a605a2f749a777e"' :
                                        'id="xs-injectables-links-module-ConfigurationModule-f57a49a6b5169480c1683d9249c41bf46db7c2934e14cd4d98f7c00d0e5ea9884bc594f3139b6576238d5f5f7b840ca1bffd13b7986f71878a605a2f749a777e"' }>
                                        <li class="link">
                                            <a href="injectables/AttributeProviderService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AttributeProviderService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/CredentialConfigService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CredentialConfigService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/CredentialsService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CredentialsService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/IssuanceService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >IssuanceService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/MdocIssuerService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >MdocIssuerService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/SchemaMetaAdapterService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SchemaMetaAdapterService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/SdjwtvcIssuerService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SdjwtvcIssuerService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/WebhookEndpointService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >WebhookEndpointService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/WebhookService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >WebhookService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/CoreModule.html" data-type="entity-link" >CoreModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-CoreModule-e42486cc4f1d31b99a0c066f8203a97282a3eae6effdd502d3ec72bdfe2efeb487f849a7c7631e7c861b51bfdf2cd3ce528379691b3e8c03f18db5105dbf8da0"' : 'data-bs-target="#xs-controllers-links-module-CoreModule-e42486cc4f1d31b99a0c066f8203a97282a3eae6effdd502d3ec72bdfe2efeb487f849a7c7631e7c861b51bfdf2cd3ce528379691b3e8c03f18db5105dbf8da0"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-CoreModule-e42486cc4f1d31b99a0c066f8203a97282a3eae6effdd502d3ec72bdfe2efeb487f849a7c7631e7c861b51bfdf2cd3ce528379691b3e8c03f18db5105dbf8da0"' :
                                            'id="xs-controllers-links-module-CoreModule-e42486cc4f1d31b99a0c066f8203a97282a3eae6effdd502d3ec72bdfe2efeb487f849a7c7631e7c861b51bfdf2cd3ce528379691b3e8c03f18db5105dbf8da0"' }>
                                            <li class="link">
                                                <a href="controllers/AppController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AppController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-CoreModule-e42486cc4f1d31b99a0c066f8203a97282a3eae6effdd502d3ec72bdfe2efeb487f849a7c7631e7c861b51bfdf2cd3ce528379691b3e8c03f18db5105dbf8da0"' : 'data-bs-target="#xs-injectables-links-module-CoreModule-e42486cc4f1d31b99a0c066f8203a97282a3eae6effdd502d3ec72bdfe2efeb487f849a7c7631e7c861b51bfdf2cd3ce528379691b3e8c03f18db5105dbf8da0"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-CoreModule-e42486cc4f1d31b99a0c066f8203a97282a3eae6effdd502d3ec72bdfe2efeb487f849a7c7631e7c861b51bfdf2cd3ce528379691b3e8c03f18db5105dbf8da0"' :
                                        'id="xs-injectables-links-module-CoreModule-e42486cc4f1d31b99a0c066f8203a97282a3eae6effdd502d3ec72bdfe2efeb487f849a7c7631e7c861b51bfdf2cd3ce528379691b3e8c03f18db5105dbf8da0"' }>
                                        <li class="link">
                                            <a href="injectables/TraceIdInterceptor.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TraceIdInterceptor</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/CryptoImplementatationModule.html" data-type="entity-link" >CryptoImplementatationModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-CryptoImplementatationModule-7aa723cf8a4215e5f436d01da1833c67e4a4c8db340798045c144823b8d690a6f80da27d9224e540cbbb6211883311e062a278fb7b90f72bf84bb7eaf191e57b"' : 'data-bs-target="#xs-injectables-links-module-CryptoImplementatationModule-7aa723cf8a4215e5f436d01da1833c67e4a4c8db340798045c144823b8d690a6f80da27d9224e540cbbb6211883311e062a278fb7b90f72bf84bb7eaf191e57b"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-CryptoImplementatationModule-7aa723cf8a4215e5f436d01da1833c67e4a4c8db340798045c144823b8d690a6f80da27d9224e540cbbb6211883311e062a278fb7b90f72bf84bb7eaf191e57b"' :
                                        'id="xs-injectables-links-module-CryptoImplementatationModule-7aa723cf8a4215e5f436d01da1833c67e4a4c8db340798045c144823b8d690a6f80da27d9224e540cbbb6211883311e062a278fb7b90f72bf84bb7eaf191e57b"' }>
                                        <li class="link">
                                            <a href="injectables/CryptoImplementationService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CryptoImplementationService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/CryptoModule.html" data-type="entity-link" >CryptoModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-CryptoModule-63085032be05642278aae474a40e114585e1f9523cddcf93dfaaf95ea07e943b6126afa60f4ff0e9140f28cf2925234ab01e8db8206a8ea5c4016eb6d3c43be6"' : 'data-bs-target="#xs-injectables-links-module-CryptoModule-63085032be05642278aae474a40e114585e1f9523cddcf93dfaaf95ea07e943b6126afa60f4ff0e9140f28cf2925234ab01e8db8206a8ea5c4016eb6d3c43be6"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-CryptoModule-63085032be05642278aae474a40e114585e1f9523cddcf93dfaaf95ea07e943b6126afa60f4ff0e9140f28cf2925234ab01e8db8206a8ea5c4016eb6d3c43be6"' :
                                        'id="xs-injectables-links-module-CryptoModule-63085032be05642278aae474a40e114585e1f9523cddcf93dfaaf95ea07e943b6126afa60f4ff0e9140f28cf2925234ab01e8db8206a8ea5c4016eb6d3c43be6"' }>
                                        <li class="link">
                                            <a href="injectables/CryptoService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CryptoService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/EncryptionService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >EncryptionService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/DatabaseModule.html" data-type="entity-link" >DatabaseModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/EncryptionModule.html" data-type="entity-link" >EncryptionModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-EncryptionModule-fddb86254d3a580111ad753be5591f9b33d4febfd5b368129eafb329b16bcde6af663cd5a856f3aa556da2162430acf6fbdd3fd0a8347f2f09a639d639666d50"' : 'data-bs-target="#xs-injectables-links-module-EncryptionModule-fddb86254d3a580111ad753be5591f9b33d4febfd5b368129eafb329b16bcde6af663cd5a856f3aa556da2162430acf6fbdd3fd0a8347f2f09a639d639666d50"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-EncryptionModule-fddb86254d3a580111ad753be5591f9b33d4febfd5b368129eafb329b16bcde6af663cd5a856f3aa556da2162430acf6fbdd3fd0a8347f2f09a639d639666d50"' :
                                        'id="xs-injectables-links-module-EncryptionModule-fddb86254d3a580111ad753be5591f9b33d4febfd5b368129eafb329b16bcde6af663cd5a856f3aa556da2162430acf6fbdd3fd0a8347f2f09a639d639666d50"' }>
                                        <li class="link">
                                            <a href="injectables/EncryptionService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >EncryptionService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/HealthModule.html" data-type="entity-link" >HealthModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-HealthModule-26797648f5640dd2e676a6c3633e82b0a8b9124e3c4df37c6c0307fa1828fa6eb1f6299f275ffd3ec2f0beaa4455a8c67f58035a90a0cb6c4d3c84250a8dca54"' : 'data-bs-target="#xs-controllers-links-module-HealthModule-26797648f5640dd2e676a6c3633e82b0a8b9124e3c4df37c6c0307fa1828fa6eb1f6299f275ffd3ec2f0beaa4455a8c67f58035a90a0cb6c4d3c84250a8dca54"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-HealthModule-26797648f5640dd2e676a6c3633e82b0a8b9124e3c4df37c6c0307fa1828fa6eb1f6299f275ffd3ec2f0beaa4455a8c67f58035a90a0cb6c4d3c84250a8dca54"' :
                                            'id="xs-controllers-links-module-HealthModule-26797648f5640dd2e676a6c3633e82b0a8b9124e3c4df37c6c0307fa1828fa6eb1f6299f275ffd3ec2f0beaa4455a8c67f58035a90a0cb6c4d3c84250a8dca54"' }>
                                            <li class="link">
                                                <a href="controllers/HealthController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >HealthController</a>
                                            </li>
                                        </ul>
                                    </li>
                            </li>
                            <li class="link">
                                <a href="modules/IssuanceModule.html" data-type="entity-link" >IssuanceModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-IssuanceModule-29aa29b51d6e00d99144f0ffc2c6827d3ca3b286147ab393de410664469c00dd29362d379a51b7fdc504c72bb773f6ec062f8887ef71a973e37ad2b805ea413a"' : 'data-bs-target="#xs-controllers-links-module-IssuanceModule-29aa29b51d6e00d99144f0ffc2c6827d3ca3b286147ab393de410664469c00dd29362d379a51b7fdc504c72bb773f6ec062f8887ef71a973e37ad2b805ea413a"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-IssuanceModule-29aa29b51d6e00d99144f0ffc2c6827d3ca3b286147ab393de410664469c00dd29362d379a51b7fdc504c72bb773f6ec062f8887ef71a973e37ad2b805ea413a"' :
                                            'id="xs-controllers-links-module-IssuanceModule-29aa29b51d6e00d99144f0ffc2c6827d3ca3b286147ab393de410664469c00dd29362d379a51b7fdc504c72bb773f6ec062f8887ef71a973e37ad2b805ea413a"' }>
                                            <li class="link">
                                                <a href="controllers/AuthorizeController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthorizeController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/ChainedAsController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ChainedAsController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/CredentialOfferController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CredentialOfferController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/DeferredController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DeferredController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/InteractiveAuthorizationController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >InteractiveAuthorizationController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/Oid4vciController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >Oid4vciController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/Oid4vciMetadataController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >Oid4vciMetadataController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/WellKnownController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >WellKnownController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-IssuanceModule-29aa29b51d6e00d99144f0ffc2c6827d3ca3b286147ab393de410664469c00dd29362d379a51b7fdc504c72bb773f6ec062f8887ef71a973e37ad2b805ea413a"' : 'data-bs-target="#xs-injectables-links-module-IssuanceModule-29aa29b51d6e00d99144f0ffc2c6827d3ca3b286147ab393de410664469c00dd29362d379a51b7fdc504c72bb773f6ec062f8887ef71a973e37ad2b805ea413a"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-IssuanceModule-29aa29b51d6e00d99144f0ffc2c6827d3ca3b286147ab393de410664469c00dd29362d379a51b7fdc504c72bb773f6ec062f8887ef71a973e37ad2b805ea413a"' :
                                        'id="xs-injectables-links-module-IssuanceModule-29aa29b51d6e00d99144f0ffc2c6827d3ca3b286147ab393de410664469c00dd29362d379a51b7fdc504c72bb773f6ec062f8887ef71a973e37ad2b805ea413a"' }>
                                        <li class="link">
                                            <a href="injectables/AuthorizeService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthorizeService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ChainedAsService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ChainedAsService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/DeferredCredentialService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DeferredCredentialService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/InteractiveAuthorizationService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >InteractiveAuthorizationService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/Oid4vciService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >Oid4vciService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/WebhookService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >WebhookService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/WellKnownService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >WellKnownService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/IssuerModule.html" data-type="entity-link" >IssuerModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/LifecycleModule.html" data-type="entity-link" >LifecycleModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/Oid4vpModule.html" data-type="entity-link" >Oid4vpModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-Oid4vpModule-9ab0f37777d20de7721ce581c15d7b2b89c178751af65572de83180b21822862a91c1707b533c517ad44e673c9ca02832342245a7005a12f1838ae7cb4c5bb2e"' : 'data-bs-target="#xs-controllers-links-module-Oid4vpModule-9ab0f37777d20de7721ce581c15d7b2b89c178751af65572de83180b21822862a91c1707b533c517ad44e673c9ca02832342245a7005a12f1838ae7cb4c5bb2e"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-Oid4vpModule-9ab0f37777d20de7721ce581c15d7b2b89c178751af65572de83180b21822862a91c1707b533c517ad44e673c9ca02832342245a7005a12f1838ae7cb4c5bb2e"' :
                                            'id="xs-controllers-links-module-Oid4vpModule-9ab0f37777d20de7721ce581c15d7b2b89c178751af65572de83180b21822862a91c1707b533c517ad44e673c9ca02832342245a7005a12f1838ae7cb4c5bb2e"' }>
                                            <li class="link">
                                                <a href="controllers/Oid4vpController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >Oid4vpController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-Oid4vpModule-9ab0f37777d20de7721ce581c15d7b2b89c178751af65572de83180b21822862a91c1707b533c517ad44e673c9ca02832342245a7005a12f1838ae7cb4c5bb2e"' : 'data-bs-target="#xs-injectables-links-module-Oid4vpModule-9ab0f37777d20de7721ce581c15d7b2b89c178751af65572de83180b21822862a91c1707b533c517ad44e673c9ca02832342245a7005a12f1838ae7cb4c5bb2e"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-Oid4vpModule-9ab0f37777d20de7721ce581c15d7b2b89c178751af65572de83180b21822862a91c1707b533c517ad44e673c9ca02832342245a7005a12f1838ae7cb4c5bb2e"' :
                                        'id="xs-injectables-links-module-Oid4vpModule-9ab0f37777d20de7721ce581c15d7b2b89c178751af65572de83180b21822862a91c1707b533c517ad44e673c9ca02832342245a7005a12f1838ae7cb4c5bb2e"' }>
                                        <li class="link">
                                            <a href="injectables/Oid4vpService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >Oid4vpService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/WebhookService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >WebhookService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/PresentationsModule.html" data-type="entity-link" >PresentationsModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-PresentationsModule-a873ef66a525afb1d4555c12ecd1a74bc175e32e55efb473678066e16fa55acff5bc379484103ed6ac5cdef6854e7c4fda1cb428f1e4b2e51e152f8f974a759e"' : 'data-bs-target="#xs-controllers-links-module-PresentationsModule-a873ef66a525afb1d4555c12ecd1a74bc175e32e55efb473678066e16fa55acff5bc379484103ed6ac5cdef6854e7c4fda1cb428f1e4b2e51e152f8f974a759e"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-PresentationsModule-a873ef66a525afb1d4555c12ecd1a74bc175e32e55efb473678066e16fa55acff5bc379484103ed6ac5cdef6854e7c4fda1cb428f1e4b2e51e152f8f974a759e"' :
                                            'id="xs-controllers-links-module-PresentationsModule-a873ef66a525afb1d4555c12ecd1a74bc175e32e55efb473678066e16fa55acff5bc379484103ed6ac5cdef6854e7c4fda1cb428f1e4b2e51e152f8f974a759e"' }>
                                            <li class="link">
                                                <a href="controllers/PresentationManagementController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >PresentationManagementController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-PresentationsModule-a873ef66a525afb1d4555c12ecd1a74bc175e32e55efb473678066e16fa55acff5bc379484103ed6ac5cdef6854e7c4fda1cb428f1e4b2e51e152f8f974a759e"' : 'data-bs-target="#xs-injectables-links-module-PresentationsModule-a873ef66a525afb1d4555c12ecd1a74bc175e32e55efb473678066e16fa55acff5bc379484103ed6ac5cdef6854e7c4fda1cb428f1e4b2e51e152f8f974a759e"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-PresentationsModule-a873ef66a525afb1d4555c12ecd1a74bc175e32e55efb473678066e16fa55acff5bc379484103ed6ac5cdef6854e7c4fda1cb428f1e4b2e51e152f8f974a759e"' :
                                        'id="xs-injectables-links-module-PresentationsModule-a873ef66a525afb1d4555c12ecd1a74bc175e32e55efb473678066e16fa55acff5bc379484103ed6ac5cdef6854e7c4fda1cb428f1e4b2e51e152f8f974a759e"' }>
                                        <li class="link">
                                            <a href="injectables/CredentialChainValidationService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CredentialChainValidationService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/MdocverifierService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >MdocverifierService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/PresentationsService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >PresentationsService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/SdjwtvcverifierService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SdjwtvcverifierService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/RegistrarModule.html" data-type="entity-link" >RegistrarModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-RegistrarModule-e94fac1d7373fc622729ad46096b4fb36346e50e2353742a7a2756e04f68642d659c89f1f6a1bce77a13dba440f6d1497be663055c13770269aad2ad1324ba67"' : 'data-bs-target="#xs-controllers-links-module-RegistrarModule-e94fac1d7373fc622729ad46096b4fb36346e50e2353742a7a2756e04f68642d659c89f1f6a1bce77a13dba440f6d1497be663055c13770269aad2ad1324ba67"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-RegistrarModule-e94fac1d7373fc622729ad46096b4fb36346e50e2353742a7a2756e04f68642d659c89f1f6a1bce77a13dba440f6d1497be663055c13770269aad2ad1324ba67"' :
                                            'id="xs-controllers-links-module-RegistrarModule-e94fac1d7373fc622729ad46096b4fb36346e50e2353742a7a2756e04f68642d659c89f1f6a1bce77a13dba440f6d1497be663055c13770269aad2ad1324ba67"' }>
                                            <li class="link">
                                                <a href="controllers/RegistrarController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RegistrarController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/SchemaMetadataController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SchemaMetadataController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-RegistrarModule-e94fac1d7373fc622729ad46096b4fb36346e50e2353742a7a2756e04f68642d659c89f1f6a1bce77a13dba440f6d1497be663055c13770269aad2ad1324ba67"' : 'data-bs-target="#xs-injectables-links-module-RegistrarModule-e94fac1d7373fc622729ad46096b4fb36346e50e2353742a7a2756e04f68642d659c89f1f6a1bce77a13dba440f6d1497be663055c13770269aad2ad1324ba67"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-RegistrarModule-e94fac1d7373fc622729ad46096b4fb36346e50e2353742a7a2756e04f68642d659c89f1f6a1bce77a13dba440f6d1497be663055c13770269aad2ad1324ba67"' :
                                        'id="xs-injectables-links-module-RegistrarModule-e94fac1d7373fc622729ad46096b4fb36346e50e2353742a7a2756e04f68642d659c89f1f6a1bce77a13dba440f6d1497be663055c13770269aad2ad1324ba67"' }>
                                        <li class="link">
                                            <a href="injectables/AccessCertificateService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AccessCertificateService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/RegistrarAuthService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RegistrarAuthService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/RegistrarConfigService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RegistrarConfigService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/RegistrarService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RegistrarService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/RegistrationCertificateService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RegistrationCertificateService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/SchemaMetadataService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SchemaMetadataService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/ResolverModule.html" data-type="entity-link" >ResolverModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-ResolverModule-f0b0dfa9c28f9d3fabbd4e331ce801bda49de6f88fefc991384f027b65d9e9421a7d405f75bb5f35eed5d8ba72b72e9941c89d4087eebbf7023ce79688f8fe0c"' : 'data-bs-target="#xs-injectables-links-module-ResolverModule-f0b0dfa9c28f9d3fabbd4e331ce801bda49de6f88fefc991384f027b65d9e9421a7d405f75bb5f35eed5d8ba72b72e9941c89d4087eebbf7023ce79688f8fe0c"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-ResolverModule-f0b0dfa9c28f9d3fabbd4e331ce801bda49de6f88fefc991384f027b65d9e9421a7d405f75bb5f35eed5d8ba72b72e9941c89d4087eebbf7023ce79688f8fe0c"' :
                                        'id="xs-injectables-links-module-ResolverModule-f0b0dfa9c28f9d3fabbd4e331ce801bda49de6f88fefc991384f027b65d9e9421a7d405f75bb5f35eed5d8ba72b72e9941c89d4087eebbf7023ce79688f8fe0c"' }>
                                        <li class="link">
                                            <a href="injectables/ResolverService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ResolverService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/SessionModule.html" data-type="entity-link" >SessionModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-SessionModule-fe281a0f11b34315f64124b6820cab6215c06bfa966103bc1a1e752b75dfe1c5a864acdaf61739f198be3660f8e064a2412ec1f30a53785f286ed258db44499f"' : 'data-bs-target="#xs-controllers-links-module-SessionModule-fe281a0f11b34315f64124b6820cab6215c06bfa966103bc1a1e752b75dfe1c5a864acdaf61739f198be3660f8e064a2412ec1f30a53785f286ed258db44499f"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-SessionModule-fe281a0f11b34315f64124b6820cab6215c06bfa966103bc1a1e752b75dfe1c5a864acdaf61739f198be3660f8e064a2412ec1f30a53785f286ed258db44499f"' :
                                            'id="xs-controllers-links-module-SessionModule-fe281a0f11b34315f64124b6820cab6215c06bfa966103bc1a1e752b75dfe1c5a864acdaf61739f198be3660f8e064a2412ec1f30a53785f286ed258db44499f"' }>
                                            <li class="link">
                                                <a href="controllers/SessionConfigController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionConfigController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/SessionController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/SessionEventsController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionEventsController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-SessionModule-fe281a0f11b34315f64124b6820cab6215c06bfa966103bc1a1e752b75dfe1c5a864acdaf61739f198be3660f8e064a2412ec1f30a53785f286ed258db44499f"' : 'data-bs-target="#xs-injectables-links-module-SessionModule-fe281a0f11b34315f64124b6820cab6215c06bfa966103bc1a1e752b75dfe1c5a864acdaf61739f198be3660f8e064a2412ec1f30a53785f286ed258db44499f"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-SessionModule-fe281a0f11b34315f64124b6820cab6215c06bfa966103bc1a1e752b75dfe1c5a864acdaf61739f198be3660f8e064a2412ec1f30a53785f286ed258db44499f"' :
                                        'id="xs-injectables-links-module-SessionModule-fe281a0f11b34315f64124b6820cab6215c06bfa966103bc1a1e752b75dfe1c5a864acdaf61739f198be3660f8e064a2412ec1f30a53785f286ed258db44499f"' }>
                                        <li class="link">
                                            <a href="injectables/SessionConfigService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionConfigService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/SessionEventsService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionEventsService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/SessionService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/SharedModule.html" data-type="entity-link" >SharedModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/StatusListModule.html" data-type="entity-link" >StatusListModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-StatusListModule-6981da31ee73f837c7cd6713dcb437ac5d117457794422744230fc308a32c5f1dce0d36a6a81335099cc9e7670355325805b3fb42102e4b8ce391cf98af02cf2"' : 'data-bs-target="#xs-controllers-links-module-StatusListModule-6981da31ee73f837c7cd6713dcb437ac5d117457794422744230fc308a32c5f1dce0d36a6a81335099cc9e7670355325805b3fb42102e4b8ce391cf98af02cf2"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-StatusListModule-6981da31ee73f837c7cd6713dcb437ac5d117457794422744230fc308a32c5f1dce0d36a6a81335099cc9e7670355325805b3fb42102e4b8ce391cf98af02cf2"' :
                                            'id="xs-controllers-links-module-StatusListModule-6981da31ee73f837c7cd6713dcb437ac5d117457794422744230fc308a32c5f1dce0d36a6a81335099cc9e7670355325805b3fb42102e4b8ce391cf98af02cf2"' }>
                                            <li class="link">
                                                <a href="controllers/StatusListConfigController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >StatusListConfigController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/StatusListController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >StatusListController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/StatusListManagementController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >StatusListManagementController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-StatusListModule-6981da31ee73f837c7cd6713dcb437ac5d117457794422744230fc308a32c5f1dce0d36a6a81335099cc9e7670355325805b3fb42102e4b8ce391cf98af02cf2"' : 'data-bs-target="#xs-injectables-links-module-StatusListModule-6981da31ee73f837c7cd6713dcb437ac5d117457794422744230fc308a32c5f1dce0d36a6a81335099cc9e7670355325805b3fb42102e4b8ce391cf98af02cf2"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-StatusListModule-6981da31ee73f837c7cd6713dcb437ac5d117457794422744230fc308a32c5f1dce0d36a6a81335099cc9e7670355325805b3fb42102e4b8ce391cf98af02cf2"' :
                                        'id="xs-injectables-links-module-StatusListModule-6981da31ee73f837c7cd6713dcb437ac5d117457794422744230fc308a32c5f1dce0d36a6a81335099cc9e7670355325805b3fb42102e4b8ce391cf98af02cf2"' }>
                                        <li class="link">
                                            <a href="injectables/StatusListConfigService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >StatusListConfigService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/StatusListService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >StatusListService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/StorageModule.html" data-type="entity-link" >StorageModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/TenantModule.html" data-type="entity-link" >TenantModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-TenantModule-30192ffb64642285baacbcfd837340c9064859e6bfdd146e5b5db74aff90a4db33fc92cdc44068400e1b4539df516843118d19d871058110e9111007cfae6787"' : 'data-bs-target="#xs-controllers-links-module-TenantModule-30192ffb64642285baacbcfd837340c9064859e6bfdd146e5b5db74aff90a4db33fc92cdc44068400e1b4539df516843118d19d871058110e9111007cfae6787"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-TenantModule-30192ffb64642285baacbcfd837340c9064859e6bfdd146e5b5db74aff90a4db33fc92cdc44068400e1b4539df516843118d19d871058110e9111007cfae6787"' :
                                            'id="xs-controllers-links-module-TenantModule-30192ffb64642285baacbcfd837340c9064859e6bfdd146e5b5db74aff90a4db33fc92cdc44068400e1b4539df516843118d19d871058110e9111007cfae6787"' }>
                                            <li class="link">
                                                <a href="controllers/TenantController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TenantController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-TenantModule-30192ffb64642285baacbcfd837340c9064859e6bfdd146e5b5db74aff90a4db33fc92cdc44068400e1b4539df516843118d19d871058110e9111007cfae6787"' : 'data-bs-target="#xs-injectables-links-module-TenantModule-30192ffb64642285baacbcfd837340c9064859e6bfdd146e5b5db74aff90a4db33fc92cdc44068400e1b4539df516843118d19d871058110e9111007cfae6787"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-TenantModule-30192ffb64642285baacbcfd837340c9064859e6bfdd146e5b5db74aff90a4db33fc92cdc44068400e1b4539df516843118d19d871058110e9111007cfae6787"' :
                                        'id="xs-injectables-links-module-TenantModule-30192ffb64642285baacbcfd837340c9064859e6bfdd146e5b5db74aff90a4db33fc92cdc44068400e1b4539df516843118d19d871058110e9111007cfae6787"' }>
                                        <li class="link">
                                            <a href="injectables/TenantService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TenantService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/TrustListModule.html" data-type="entity-link" >TrustListModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-TrustListModule-5168d318da8eb7ebcf5a7685abfc77dc6a73f1a112c638e94cd0bc7ae5d3783420cffc06d9c8e720f84af2579ddd1b5a61456cadf6f8bd443d2f986cd2aec882"' : 'data-bs-target="#xs-controllers-links-module-TrustListModule-5168d318da8eb7ebcf5a7685abfc77dc6a73f1a112c638e94cd0bc7ae5d3783420cffc06d9c8e720f84af2579ddd1b5a61456cadf6f8bd443d2f986cd2aec882"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-TrustListModule-5168d318da8eb7ebcf5a7685abfc77dc6a73f1a112c638e94cd0bc7ae5d3783420cffc06d9c8e720f84af2579ddd1b5a61456cadf6f8bd443d2f986cd2aec882"' :
                                            'id="xs-controllers-links-module-TrustListModule-5168d318da8eb7ebcf5a7685abfc77dc6a73f1a112c638e94cd0bc7ae5d3783420cffc06d9c8e720f84af2579ddd1b5a61456cadf6f8bd443d2f986cd2aec882"' }>
                                            <li class="link">
                                                <a href="controllers/TrustListController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TrustListController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/TrustListPublicController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TrustListPublicController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-TrustListModule-5168d318da8eb7ebcf5a7685abfc77dc6a73f1a112c638e94cd0bc7ae5d3783420cffc06d9c8e720f84af2579ddd1b5a61456cadf6f8bd443d2f986cd2aec882"' : 'data-bs-target="#xs-injectables-links-module-TrustListModule-5168d318da8eb7ebcf5a7685abfc77dc6a73f1a112c638e94cd0bc7ae5d3783420cffc06d9c8e720f84af2579ddd1b5a61456cadf6f8bd443d2f986cd2aec882"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-TrustListModule-5168d318da8eb7ebcf5a7685abfc77dc6a73f1a112c638e94cd0bc7ae5d3783420cffc06d9c8e720f84af2579ddd1b5a61456cadf6f8bd443d2f986cd2aec882"' :
                                        'id="xs-injectables-links-module-TrustListModule-5168d318da8eb7ebcf5a7685abfc77dc6a73f1a112c638e94cd0bc7ae5d3783420cffc06d9c8e720f84af2579ddd1b5a61456cadf6f8bd443d2f986cd2aec882"' }>
                                        <li class="link">
                                            <a href="injectables/TrustListService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TrustListService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/TrustModule.html" data-type="entity-link" >TrustModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-TrustModule-e0fd1df42e1e6a3785e1691c68567eeb5c4035c52471392849d242b37b835cbf1a5adef965cf2407a0e44c302648de51015a7a9f5e684654d64f6a67af33595d"' : 'data-bs-target="#xs-controllers-links-module-TrustModule-e0fd1df42e1e6a3785e1691c68567eeb5c4035c52471392849d242b37b835cbf1a5adef965cf2407a0e44c302648de51015a7a9f5e684654d64f6a67af33595d"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-TrustModule-e0fd1df42e1e6a3785e1691c68567eeb5c4035c52471392849d242b37b835cbf1a5adef965cf2407a0e44c302648de51015a7a9f5e684654d64f6a67af33595d"' :
                                            'id="xs-controllers-links-module-TrustModule-e0fd1df42e1e6a3785e1691c68567eeb5c4035c52471392849d242b37b835cbf1a5adef965cf2407a0e44c302648de51015a7a9f5e684654d64f6a67af33595d"' }>
                                            <li class="link">
                                                <a href="controllers/CacheController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CacheController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-TrustModule-e0fd1df42e1e6a3785e1691c68567eeb5c4035c52471392849d242b37b835cbf1a5adef965cf2407a0e44c302648de51015a7a9f5e684654d64f6a67af33595d"' : 'data-bs-target="#xs-injectables-links-module-TrustModule-e0fd1df42e1e6a3785e1691c68567eeb5c4035c52471392849d242b37b835cbf1a5adef965cf2407a0e44c302648de51015a7a9f5e684654d64f6a67af33595d"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-TrustModule-e0fd1df42e1e6a3785e1691c68567eeb5c4035c52471392849d242b37b835cbf1a5adef965cf2407a0e44c302648de51015a7a9f5e684654d64f6a67af33595d"' :
                                        'id="xs-injectables-links-module-TrustModule-e0fd1df42e1e6a3785e1691c68567eeb5c4035c52471392849d242b37b835cbf1a5adef965cf2407a0e44c302648de51015a7a9f5e684654d64f6a67af33595d"' }>
                                        <li class="link">
                                            <a href="injectables/LoteParserService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >LoteParserService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/StatusListVerifierService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >StatusListVerifierService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/TrustListJwtService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TrustListJwtService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/TrustStoreService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TrustStoreService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/WalletAttestationService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >WalletAttestationService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/X509ValidationService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >X509ValidationService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/UserModule.html" data-type="entity-link" >UserModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-UserModule-197e5a34874996d2bd013c7da95a32a5007b5ea269d7efa2c93c7f456897fe74b71a9a9f96568570a514983e1b8d05fee73d9bcc5171636588ef6446bb6debd8"' : 'data-bs-target="#xs-controllers-links-module-UserModule-197e5a34874996d2bd013c7da95a32a5007b5ea269d7efa2c93c7f456897fe74b71a9a9f96568570a514983e1b8d05fee73d9bcc5171636588ef6446bb6debd8"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-UserModule-197e5a34874996d2bd013c7da95a32a5007b5ea269d7efa2c93c7f456897fe74b71a9a9f96568570a514983e1b8d05fee73d9bcc5171636588ef6446bb6debd8"' :
                                            'id="xs-controllers-links-module-UserModule-197e5a34874996d2bd013c7da95a32a5007b5ea269d7efa2c93c7f456897fe74b71a9a9f96568570a514983e1b8d05fee73d9bcc5171636588ef6446bb6debd8"' }>
                                            <li class="link">
                                                <a href="controllers/UserController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UserController</a>
                                            </li>
                                        </ul>
                                    </li>
                            </li>
                            <li class="link">
                                <a href="modules/VerifierModule.html" data-type="entity-link" >VerifierModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-VerifierModule-fd1fd4275d09e92c429d29345ce0fe7cb317e51dd12793aa0ed6716bf0b7e59a7ad7a0518aa1bacfe625cd7d9bcfd969a796482dfb84afdc199a916e9c7ad2f6"' : 'data-bs-target="#xs-controllers-links-module-VerifierModule-fd1fd4275d09e92c429d29345ce0fe7cb317e51dd12793aa0ed6716bf0b7e59a7ad7a0518aa1bacfe625cd7d9bcfd969a796482dfb84afdc199a916e9c7ad2f6"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-VerifierModule-fd1fd4275d09e92c429d29345ce0fe7cb317e51dd12793aa0ed6716bf0b7e59a7ad7a0518aa1bacfe625cd7d9bcfd969a796482dfb84afdc199a916e9c7ad2f6"' :
                                            'id="xs-controllers-links-module-VerifierModule-fd1fd4275d09e92c429d29345ce0fe7cb317e51dd12793aa0ed6716bf0b7e59a7ad7a0518aa1bacfe625cd7d9bcfd969a796482dfb84afdc199a916e9c7ad2f6"' }>
                                            <li class="link">
                                                <a href="controllers/VerifierOfferController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >VerifierOfferController</a>
                                            </li>
                                        </ul>
                                    </li>
                            </li>
                </ul>
                </li>
                        <li class="chapter">
                            <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#controllers-links"' :
                                'data-bs-target="#xs-controllers-links"' }>
                                <span class="icon ion-md-swap"></span>
                                <span>Controllers</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                            <ul class="links collapse " ${ isNormalMode ? 'id="controllers-links"' : 'id="xs-controllers-links"' }>
                                <li class="link">
                                    <a href="controllers/KeyChainController.html" data-type="entity-link" >KeyChainController</a>
                                </li>
                                <li class="link">
                                    <a href="controllers/StorageController.html" data-type="entity-link" >StorageController</a>
                                </li>
                            </ul>
                        </li>
                        <li class="chapter">
                            <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#entities-links"' :
                                'data-bs-target="#xs-entities-links"' }>
                                <span class="icon ion-ios-apps"></span>
                                <span>Entities</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                            <ul class="links collapse " ${ isNormalMode ? 'id="entities-links"' : 'id="xs-entities-links"' }>
                                <li class="link">
                                    <a href="entities/AttributeProviderEntity.html" data-type="entity-link" >AttributeProviderEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/AuditLogEntity.html" data-type="entity-link" >AuditLogEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/ChainedAsSessionEntity.html" data-type="entity-link" >ChainedAsSessionEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/ClientEntity.html" data-type="entity-link" >ClientEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/CredentialConfig.html" data-type="entity-link" >CredentialConfig</a>
                                </li>
                                <li class="link">
                                    <a href="entities/DeferredTransactionEntity.html" data-type="entity-link" >DeferredTransactionEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/FileEntity.html" data-type="entity-link" >FileEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/InteractiveAuthSessionEntity.html" data-type="entity-link" >InteractiveAuthSessionEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/IssuanceConfig.html" data-type="entity-link" >IssuanceConfig</a>
                                </li>
                                <li class="link">
                                    <a href="entities/KeyChainEntity.html" data-type="entity-link" >KeyChainEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/NonceEntity.html" data-type="entity-link" >NonceEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/PresentationConfig.html" data-type="entity-link" >PresentationConfig</a>
                                </li>
                                <li class="link">
                                    <a href="entities/RegistrarConfigEntity.html" data-type="entity-link" >RegistrarConfigEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/RegistrarEntity.html" data-type="entity-link" >RegistrarEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/Session.html" data-type="entity-link" >Session</a>
                                </li>
                                <li class="link">
                                    <a href="entities/SessionLogEntry.html" data-type="entity-link" >SessionLogEntry</a>
                                </li>
                                <li class="link">
                                    <a href="entities/StatusListEntity.html" data-type="entity-link" >StatusListEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/StatusMapping.html" data-type="entity-link" >StatusMapping</a>
                                </li>
                                <li class="link">
                                    <a href="entities/TenantEntity.html" data-type="entity-link" >TenantEntity</a>
                                </li>
                                <li class="link">
                                    <a href="entities/TrustList.html" data-type="entity-link" >TrustList</a>
                                </li>
                                <li class="link">
                                    <a href="entities/TrustListVersion.html" data-type="entity-link" >TrustListVersion</a>
                                </li>
                                <li class="link">
                                    <a href="entities/WebhookEndpointEntity.html" data-type="entity-link" >WebhookEndpointEntity</a>
                                </li>
                            </ul>
                        </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#classes-links"' :
                            'data-bs-target="#xs-classes-links"' }>
                            <span class="icon ion-ios-paper"></span>
                            <span>Classes</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="classes-links"' : 'id="xs-classes-links"' }>
                            <li class="link">
                                <a href="classes/AccessCertificateRefDto.html" data-type="entity-link" >AccessCertificateRefDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddCredentialRequestEncryptionToIssuanceConfig1753100000000.html" data-type="entity-link" >AddCredentialRequestEncryptionToIssuanceConfig1753100000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddCredentialResponseEncryptionToIssuanceConfig1753000000000.html" data-type="entity-link" >AddCredentialResponseEncryptionToIssuanceConfig1753000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddDirectPostSecurityFields1751000000000.html" data-type="entity-link" >AddDirectPostSecurityFields1751000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddExternalKeyId1742000000000.html" data-type="entity-link" >AddExternalKeyId1742000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddKeyRotation1744000000000.html" data-type="entity-link" >AddKeyRotation1744000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddKeyUsageEntity1743000000000.html" data-type="entity-link" >AddKeyUsageEntity1743000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddKmsProvider1740500000000.html" data-type="entity-link" >AddKmsProvider1740500000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddPreferredAuthServerToIssuanceConfig1741500000000.html" data-type="entity-link" >AddPreferredAuthServerToIssuanceConfig1741500000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddRefreshTokenToChainedAsSession1754000000000.html" data-type="entity-link" >AddRefreshTokenToChainedAsSession1754000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddRefreshTokenToSession1752000000000.html" data-type="entity-link" >AddRefreshTokenToSession1752000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddRegistrationCertCacheToPresentationConfig1756000000000.html" data-type="entity-link" >AddRegistrationCertCacheToPresentationConfig1756000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddRegistrationCertificateDefaultsToRegistrarConfig1755000000000.html" data-type="entity-link" >AddRegistrationCertificateDefaultsToRegistrarConfig1755000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddSchemaMetaToCredentialConfig1761000000000.html" data-type="entity-link" >AddSchemaMetaToCredentialConfig1761000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddSessionErrorReason1750000000000.html" data-type="entity-link" >AddSessionErrorReason1750000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddSessionLogEntry1749000000000.html" data-type="entity-link" >AddSessionLogEntry1749000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddSessionSingleUseTracking1760000000000.html" data-type="entity-link" >AddSessionSingleUseTracking1760000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddSigningKeyIdToIssuanceConfig1741000000000.html" data-type="entity-link" >AddSigningKeyIdToIssuanceConfig1741000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddTenantActionLog1762000000000.html" data-type="entity-link" >AddTenantActionLog1762000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddTxCodeAttemptTracking1757000000000.html" data-type="entity-link" >AddTxCodeAttemptTracking1757000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AllExceptionsFilter.html" data-type="entity-link" >AllExceptionsFilter</a>
                            </li>
                            <li class="link">
                                <a href="classes/AllowListPolicy.html" data-type="entity-link" >AllowListPolicy</a>
                            </li>
                            <li class="link">
                                <a href="classes/ApiKeyConfig.html" data-type="entity-link" >ApiKeyConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/AttestationBasedPolicy.html" data-type="entity-link" >AttestationBasedPolicy</a>
                            </li>
                            <li class="link">
                                <a href="classes/AttributeProviderClaimsSource.html" data-type="entity-link" >AttributeProviderClaimsSource</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuditLogResponseDto.html" data-type="entity-link" >AuditLogResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthenticationMethodAuth.html" data-type="entity-link" >AuthenticationMethodAuth</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthenticationMethodNone.html" data-type="entity-link" >AuthenticationMethodNone</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthenticationMethodPresentation.html" data-type="entity-link" >AuthenticationMethodPresentation</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthenticationUrlConfig.html" data-type="entity-link" >AuthenticationUrlConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthorizationDetailsDto.html" data-type="entity-link" >AuthorizationDetailsDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthorizationResponse.html" data-type="entity-link" >AuthorizationResponse</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthorizationResponse-1.html" data-type="entity-link" >AuthorizationResponse</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthorizeQueries.html" data-type="entity-link" >AuthorizeQueries</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthResponse.html" data-type="entity-link" >AuthResponse</a>
                            </li>
                            <li class="link">
                                <a href="classes/AwsKmsConfigDto.html" data-type="entity-link" >AwsKmsConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/BaseKmsProviderConfigDto.html" data-type="entity-link" >BaseKmsProviderConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/BaselineMigration1740000000000.html" data-type="entity-link" >BaselineMigration1740000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/CaHasDependentKeysException.html" data-type="entity-link" >CaHasDependentKeysException</a>
                            </li>
                            <li class="link">
                                <a href="classes/CertificateInfoDto.html" data-type="entity-link" >CertificateInfoDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CertResponseDto.html" data-type="entity-link" >CertResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChainedAsAuthorizeQueryDto.html" data-type="entity-link" >ChainedAsAuthorizeQueryDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChainedAsConfig.html" data-type="entity-link" >ChainedAsConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChainedAsErrorResponseDto.html" data-type="entity-link" >ChainedAsErrorResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChainedAsParRequestDto.html" data-type="entity-link" >ChainedAsParRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChainedAsParResponseDto.html" data-type="entity-link" >ChainedAsParResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChainedAsTokenConfig.html" data-type="entity-link" >ChainedAsTokenConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChainedAsTokenRequestDto.html" data-type="entity-link" >ChainedAsTokenRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChainedAsTokenResponseDto.html" data-type="entity-link" >ChainedAsTokenResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ClaimDisplayInfo.html" data-type="entity-link" >ClaimDisplayInfo</a>
                            </li>
                            <li class="link">
                                <a href="classes/ClaimMetadata.html" data-type="entity-link" >ClaimMetadata</a>
                            </li>
                            <li class="link">
                                <a href="classes/ClaimsQuery.html" data-type="entity-link" >ClaimsQuery</a>
                            </li>
                            <li class="link">
                                <a href="classes/ClientCredentialsDto.html" data-type="entity-link" >ClientCredentialsDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ClientSecretResponseDto.html" data-type="entity-link" >ClientSecretResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ClientsProvider.html" data-type="entity-link" >ClientsProvider</a>
                            </li>
                            <li class="link">
                                <a href="classes/CompleteDeferredDto.html" data-type="entity-link" >CompleteDeferredDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateAccessCertificateDto.html" data-type="entity-link" >CreateAccessCertificateDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateAttributeProviderDto.html" data-type="entity-link" >CreateAttributeProviderDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateClientDto.html" data-type="entity-link" >CreateClientDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateRegistrarConfigDto.html" data-type="entity-link" >CreateRegistrarConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateStatusListDto.html" data-type="entity-link" >CreateStatusListDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateTenantDto.html" data-type="entity-link" >CreateTenantDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateUserDto.html" data-type="entity-link" >CreateUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateWebhookEndpointDto.html" data-type="entity-link" >CreateWebhookEndpointDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialClaimsMatchIdsConstraint.html" data-type="entity-link" >CredentialClaimsMatchIdsConstraint</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialConfig.html" data-type="entity-link" >CredentialConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialConfigCreate.html" data-type="entity-link" >CredentialConfigCreate</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialConfigMapping.html" data-type="entity-link" >CredentialConfigMapping</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialConfigUpdate.html" data-type="entity-link" >CredentialConfigUpdate</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialIssuerMetadataDto.html" data-type="entity-link" >CredentialIssuerMetadataDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialQuery.html" data-type="entity-link" >CredentialQuery</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialRequestException.html" data-type="entity-link" >CredentialRequestException</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialSetQuery.html" data-type="entity-link" >CredentialSetQuery</a>
                            </li>
                            <li class="link">
                                <a href="classes/DbKmsConfigDto.html" data-type="entity-link" >DbKmsConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/DCQL.html" data-type="entity-link" >DCQL</a>
                            </li>
                            <li class="link">
                                <a href="classes/DeferredCredentialException.html" data-type="entity-link" >DeferredCredentialException</a>
                            </li>
                            <li class="link">
                                <a href="classes/DeferredCredentialRequestDto.html" data-type="entity-link" >DeferredCredentialRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/DeferredOperationResponse.html" data-type="entity-link" >DeferredOperationResponse</a>
                            </li>
                            <li class="link">
                                <a href="classes/DeprecateSchemaMetadataDto.html" data-type="entity-link" >DeprecateSchemaMetadataDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/Display.html" data-type="entity-link" >Display</a>
                            </li>
                            <li class="link">
                                <a href="classes/DisplayImage.html" data-type="entity-link" >DisplayImage</a>
                            </li>
                            <li class="link">
                                <a href="classes/DisplayInfo.html" data-type="entity-link" >DisplayInfo</a>
                            </li>
                            <li class="link">
                                <a href="classes/DisplayLogo.html" data-type="entity-link" >DisplayLogo</a>
                            </li>
                            <li class="link">
                                <a href="classes/EC_Public.html" data-type="entity-link" >EC_Public</a>
                            </li>
                            <li class="link">
                                <a href="classes/EcJwk.html" data-type="entity-link" >EcJwk</a>
                            </li>
                            <li class="link">
                                <a href="classes/EmbeddedDisclosurePolicy.html" data-type="entity-link" >EmbeddedDisclosurePolicy</a>
                            </li>
                            <li class="link">
                                <a href="classes/ExportEcJwk.html" data-type="entity-link" >ExportEcJwk</a>
                            </li>
                            <li class="link">
                                <a href="classes/ExportRotationPolicyDto.html" data-type="entity-link" >ExportRotationPolicyDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ExternalTrustListEntity.html" data-type="entity-link" >ExternalTrustListEntity</a>
                            </li>
                            <li class="link">
                                <a href="classes/ExtractAttributeProviderAndWebhookEndpoint1748000000000.html" data-type="entity-link" >ExtractAttributeProviderAndWebhookEndpoint1748000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/FailDeferredDto.html" data-type="entity-link" >FailDeferredDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/FileUploadDto.html" data-type="entity-link" >FileUploadDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/FlattenKeyUsageType1746000000000.html" data-type="entity-link" >FlattenKeyUsageType1746000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/FrontendConfigResponseDto.html" data-type="entity-link" >FrontendConfigResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/GrafanaConfigDto.html" data-type="entity-link" >GrafanaConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/IaeActionBase.html" data-type="entity-link" >IaeActionBase</a>
                            </li>
                            <li class="link">
                                <a href="classes/IaeActionOpenid4vpPresentation.html" data-type="entity-link" >IaeActionOpenid4vpPresentation</a>
                            </li>
                            <li class="link">
                                <a href="classes/IaeActionRedirectToWeb.html" data-type="entity-link" >IaeActionRedirectToWeb</a>
                            </li>
                            <li class="link">
                                <a href="classes/IaeActionsWrapper.html" data-type="entity-link" >IaeActionsWrapper</a>
                            </li>
                            <li class="link">
                                <a href="classes/ImportTenantDto.html" data-type="entity-link" >ImportTenantDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/IncompletePresentationException.html" data-type="entity-link" >IncompletePresentationException</a>
                            </li>
                            <li class="link">
                                <a href="classes/InlineClaimsSource.html" data-type="entity-link" >InlineClaimsSource</a>
                            </li>
                            <li class="link">
                                <a href="classes/InteractiveAuthorizationCodeResponseDto.html" data-type="entity-link" >InteractiveAuthorizationCodeResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/InteractiveAuthorizationErrorResponseDto.html" data-type="entity-link" >InteractiveAuthorizationErrorResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/InteractiveAuthorizationFollowUpRequestDto.html" data-type="entity-link" >InteractiveAuthorizationFollowUpRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/InteractiveAuthorizationInitialRequestDto.html" data-type="entity-link" >InteractiveAuthorizationInitialRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/InteractiveAuthorizationOpenid4vpResponseDto.html" data-type="entity-link" >InteractiveAuthorizationOpenid4vpResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/InteractiveAuthorizationRedirectToWebResponseDto.html" data-type="entity-link" >InteractiveAuthorizationRedirectToWebResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/InteractiveAuthorizationRequestDto.html" data-type="entity-link" >InteractiveAuthorizationRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/InternalTrustListEntity.html" data-type="entity-link" >InternalTrustListEntity</a>
                            </li>
                            <li class="link">
                                <a href="classes/IssuanceConfig.html" data-type="entity-link" >IssuanceConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/IssuanceDto.html" data-type="entity-link" >IssuanceDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/IssuerMetadataCredentialConfig.html" data-type="entity-link" >IssuerMetadataCredentialConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/IsTransactionDataConstraint.html" data-type="entity-link" >IsTransactionDataConstraint</a>
                            </li>
                            <li class="link">
                                <a href="classes/JwksResponseDto.html" data-type="entity-link" >JwksResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KeyAttestationsRequired.html" data-type="entity-link" >KeyAttestationsRequired</a>
                            </li>
                            <li class="link">
                                <a href="classes/KeyChainCreateDto.html" data-type="entity-link" >KeyChainCreateDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KeyChainExportDto.html" data-type="entity-link" >KeyChainExportDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KeyChainImportDto.html" data-type="entity-link" >KeyChainImportDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KeyChainResponseDto.html" data-type="entity-link" >KeyChainResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KeyChainUpdateDto.html" data-type="entity-link" >KeyChainUpdateDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KeyModule.html" data-type="entity-link" >KeyModule</a>
                            </li>
                            <li class="link">
                                <a href="classes/KeyObj.html" data-type="entity-link" >KeyObj</a>
                            </li>
                            <li class="link">
                                <a href="classes/KeyResponseDto.html" data-type="entity-link" >KeyResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KmsConfigDto.html" data-type="entity-link" >KmsConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KmsProviderCapabilitiesDto.html" data-type="entity-link" >KmsProviderCapabilitiesDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KmsProviderInfoDto.html" data-type="entity-link" >KmsProviderInfoDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KmsProvidersResponseDto.html" data-type="entity-link" >KmsProvidersResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/LocalFileStorage.html" data-type="entity-link" >LocalFileStorage</a>
                            </li>
                            <li class="link">
                                <a href="classes/ManagedUserDto.html" data-type="entity-link" >ManagedUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/MetadataSchemaDto.html" data-type="entity-link" >MetadataSchemaDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/MigrateKeysToKeyChain1747000000000.html" data-type="entity-link" >MigrateKeysToKeyChain1747000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/NoneTrustPolicy.html" data-type="entity-link" >NoneTrustPolicy</a>
                            </li>
                            <li class="link">
                                <a href="classes/NotificationRequestDto.html" data-type="entity-link" >NotificationRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/OfferRequestDto.html" data-type="entity-link" >OfferRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/OfferResponse.html" data-type="entity-link" >OfferResponse</a>
                            </li>
                            <li class="link">
                                <a href="classes/Openid4vpRequestDto.html" data-type="entity-link" >Openid4vpRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ParResponseDto.html" data-type="entity-link" >ParResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/PolicyCredential.html" data-type="entity-link" >PolicyCredential</a>
                            </li>
                            <li class="link">
                                <a href="classes/PresentationAttachment.html" data-type="entity-link" >PresentationAttachment</a>
                            </li>
                            <li class="link">
                                <a href="classes/PresentationConfigCreateDto.html" data-type="entity-link" >PresentationConfigCreateDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/PresentationConfigUpdateDto.html" data-type="entity-link" >PresentationConfigUpdateDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/PresentationDuringIssuanceConfig.html" data-type="entity-link" >PresentationDuringIssuanceConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/PresentationRequest.html" data-type="entity-link" >PresentationRequest</a>
                            </li>
                            <li class="link">
                                <a href="classes/PublicKeyInfoDto.html" data-type="entity-link" >PublicKeyInfoDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RegistrarConfigResponseDto.html" data-type="entity-link" >RegistrarConfigResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RegistrationCertificateBody.html" data-type="entity-link" >RegistrationCertificateBody</a>
                            </li>
                            <li class="link">
                                <a href="classes/RegistrationCertificateDefaults.html" data-type="entity-link" >RegistrationCertificateDefaults</a>
                            </li>
                            <li class="link">
                                <a href="classes/RegistrationCertificatePurpose.html" data-type="entity-link" >RegistrationCertificatePurpose</a>
                            </li>
                            <li class="link">
                                <a href="classes/RegistrationCertificateRequest.html" data-type="entity-link" >RegistrationCertificateRequest</a>
                            </li>
                            <li class="link">
                                <a href="classes/RenameSigningToAttestation1745000000000.html" data-type="entity-link" >RenameSigningToAttestation1745000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/ReservationResponseDto.html" data-type="entity-link" >ReservationResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ReserveSchemaMetadataDto.html" data-type="entity-link" >ReserveSchemaMetadataDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ResolveIssuerMetadataDto.html" data-type="entity-link" >ResolveIssuerMetadataDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ResolveSchemaMetadataDto.html" data-type="entity-link" >ResolveSchemaMetadataDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RoleDto.html" data-type="entity-link" >RoleDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RootOfTrustPolicy.html" data-type="entity-link" >RootOfTrustPolicy</a>
                            </li>
                            <li class="link">
                                <a href="classes/RotationPolicyCreateDto.html" data-type="entity-link" >RotationPolicyCreateDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RotationPolicyDto.html" data-type="entity-link" >RotationPolicyDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RotationPolicyImportDto.html" data-type="entity-link" >RotationPolicyImportDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RotationPolicyResponseDto.html" data-type="entity-link" >RotationPolicyResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RotationPolicyUpdateDto.html" data-type="entity-link" >RotationPolicyUpdateDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/S3FileStorage.html" data-type="entity-link" >S3FileStorage</a>
                            </li>
                            <li class="link">
                                <a href="classes/SchemaMetaConfig.html" data-type="entity-link" >SchemaMetaConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/SchemaMetadataResponseDto.html" data-type="entity-link" >SchemaMetadataResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/SchemaMetadataVocabulariesDto.html" data-type="entity-link" >SchemaMetadataVocabulariesDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/SchemaResponse.html" data-type="entity-link" >SchemaResponse</a>
                            </li>
                            <li class="link">
                                <a href="classes/SchemaUriEntry.html" data-type="entity-link" >SchemaUriEntry</a>
                            </li>
                            <li class="link">
                                <a href="classes/SessionLogEntryResponseDto.html" data-type="entity-link" >SessionLogEntryResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/SessionStorageConfig.html" data-type="entity-link" >SessionStorageConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/SignSchemaMetaConfigDto.html" data-type="entity-link" >SignSchemaMetaConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/SignVersionSchemaMetaConfigDto.html" data-type="entity-link" >SignVersionSchemaMetaConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/StatusListAggregationDto.html" data-type="entity-link" >StatusListAggregationDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/StatusListConfig.html" data-type="entity-link" >StatusListConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/StatusListImportDto.html" data-type="entity-link" >StatusListImportDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/StatusListResponseDto.html" data-type="entity-link" >StatusListResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/StatusUpdateDto.html" data-type="entity-link" >StatusUpdateDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/SubmitSchemaMetadataDto.html" data-type="entity-link" >SubmitSchemaMetadataDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/TokenErrorException.html" data-type="entity-link" >TokenErrorException</a>
                            </li>
                            <li class="link">
                                <a href="classes/TokenResponse.html" data-type="entity-link" >TokenResponse</a>
                            </li>
                            <li class="link">
                                <a href="classes/TransactionData.html" data-type="entity-link" >TransactionData</a>
                            </li>
                            <li class="link">
                                <a href="classes/TrustAuthorityDto.html" data-type="entity-link" >TrustAuthorityDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/TrustAuthorityEntry.html" data-type="entity-link" >TrustAuthorityEntry</a>
                            </li>
                            <li class="link">
                                <a href="classes/TrustedAuthorityQuery.html" data-type="entity-link" >TrustedAuthorityQuery</a>
                            </li>
                            <li class="link">
                                <a href="classes/TrustListCreateDto.html" data-type="entity-link" >TrustListCreateDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/TrustListEntityInfo.html" data-type="entity-link" >TrustListEntityInfo</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateAttributeProviderDto.html" data-type="entity-link" >UpdateAttributeProviderDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateClientDto.html" data-type="entity-link" >UpdateClientDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateRegistrarConfigDto.html" data-type="entity-link" >UpdateRegistrarConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateSchemaMetadataDto.html" data-type="entity-link" >UpdateSchemaMetadataDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateSessionConfigDto.html" data-type="entity-link" >UpdateSessionConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateStatusListConfigDto.html" data-type="entity-link" >UpdateStatusListConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateStatusListDto.html" data-type="entity-link" >UpdateStatusListDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateTenantDto.html" data-type="entity-link" >UpdateTenantDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateUserDto.html" data-type="entity-link" >UpdateUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateWebhookEndpointDto.html" data-type="entity-link" >UpdateWebhookEndpointDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpstreamOidcConfig.html" data-type="entity-link" >UpstreamOidcConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/UsersProvider.html" data-type="entity-link" >UsersProvider</a>
                            </li>
                            <li class="link">
                                <a href="classes/ValidationErrorFilter.html" data-type="entity-link" >ValidationErrorFilter</a>
                            </li>
                            <li class="link">
                                <a href="classes/VaultKmsConfigDto.html" data-type="entity-link" >VaultKmsConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/VCT.html" data-type="entity-link" >VCT</a>
                            </li>
                            <li class="link">
                                <a href="classes/VocabularyEntryDto.html" data-type="entity-link" >VocabularyEntryDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/WebHookAuthConfig.html" data-type="entity-link" >WebHookAuthConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/WebHookAuthConfigHeader.html" data-type="entity-link" >WebHookAuthConfigHeader</a>
                            </li>
                            <li class="link">
                                <a href="classes/WebHookAuthConfigNone.html" data-type="entity-link" >WebHookAuthConfigNone</a>
                            </li>
                            <li class="link">
                                <a href="classes/WebhookClaimsSource.html" data-type="entity-link" >WebhookClaimsSource</a>
                            </li>
                            <li class="link">
                                <a href="classes/WebhookConfig.html" data-type="entity-link" >WebhookConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/WellKnownException.html" data-type="entity-link" >WellKnownException</a>
                            </li>
                        </ul>
                    </li>
                        <li class="chapter">
                            <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#injectables-links"' :
                                'data-bs-target="#xs-injectables-links"' }>
                                <span class="icon ion-md-arrow-round-down"></span>
                                <span>Injectables</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                            <ul class="links collapse " ${ isNormalMode ? 'id="injectables-links"' : 'id="xs-injectables-links"' }>
                                <li class="link">
                                    <a href="injectables/AwsSecretsManagerEncryptionKeyProvider.html" data-type="entity-link" >AwsSecretsManagerEncryptionKeyProvider</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/AzureKeyVaultEncryptionKeyProvider.html" data-type="entity-link" >AzureKeyVaultEncryptionKeyProvider</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/CertService.html" data-type="entity-link" >CertService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/CrlValidationService.html" data-type="entity-link" >CrlValidationService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/EnvEncryptionKeyProvider.html" data-type="entity-link" >EnvEncryptionKeyProvider</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/FilesService.html" data-type="entity-link" >FilesService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/InternalClientsProvider.html" data-type="entity-link" >InternalClientsProvider</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/InternalUsersProvider.html" data-type="entity-link" >InternalUsersProvider</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/JwtAuthGuard.html" data-type="entity-link" >JwtAuthGuard</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/KeyChainService.html" data-type="entity-link" >KeyChainService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/KeycloakClientsProvider.html" data-type="entity-link" >KeycloakClientsProvider</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/KeycloakUsersProvider.html" data-type="entity-link" >KeycloakUsersProvider</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/KeyRotationService.html" data-type="entity-link" >KeyRotationService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/VaultEncryptionKeyProvider.html" data-type="entity-link" >VaultEncryptionKeyProvider</a>
                                </li>
                            </ul>
                        </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#guards-links"' :
                            'data-bs-target="#xs-guards-links"' }>
                            <span class="icon ion-ios-lock"></span>
                            <span>Guards</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="guards-links"' : 'id="xs-guards-links"' }>
                            <li class="link">
                                <a href="guards/RolesGuard.html" data-type="entity-link" >RolesGuard</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#interfaces-links"' :
                            'data-bs-target="#xs-interfaces-links"' }>
                            <span class="icon ion-md-information-circle-outline"></span>
                            <span>Interfaces</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? ' id="interfaces-links"' : 'id="xs-interfaces-links"' }>
                            <li class="link">
                                <a href="interfaces/AccessCertificateResponse.html" data-type="entity-link" >AccessCertificateResponse</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/AuditLogActor.html" data-type="entity-link" >AuditLogActor</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/AuditLogContext.html" data-type="entity-link" >AuditLogContext</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/AuditLogContext-1.html" data-type="entity-link" >AuditLogContext</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/AuditLogRequestMeta.html" data-type="entity-link" >AuditLogRequestMeta</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/AuthenticationMethodInterface.html" data-type="entity-link" >AuthenticationMethodInterface</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/AuthorizationIdentity.html" data-type="entity-link" >AuthorizationIdentity</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/BuildCredentialConfigOptions.html" data-type="entity-link" >BuildCredentialConfigOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CachedCrl.html" data-type="entity-link" >CachedCrl</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CachedJwt.html" data-type="entity-link" >CachedJwt</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CachedStatusList.html" data-type="entity-link" >CachedStatusList</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CachedToken.html" data-type="entity-link" >CachedToken</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CertificateChainInfo.html" data-type="entity-link" >CertificateChainInfo</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CertificateInfo.html" data-type="entity-link" >CertificateInfo</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CertValidationResult.html" data-type="entity-link" >CertValidationResult</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ChainValidationPolicy.html" data-type="entity-link" >ChainValidationPolicy</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ChainValidationResult.html" data-type="entity-link" >ChainValidationResult</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ClaimDisplayInput.html" data-type="entity-link" >ClaimDisplayInput</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ClaimMetadataInput.html" data-type="entity-link" >ClaimMetadataInput</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ClaimsWebhookResult.html" data-type="entity-link" >ClaimsWebhookResult</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ClientAttestation.html" data-type="entity-link" >ClientAttestation</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CreateDeferredTransactionParams.html" data-type="entity-link" >CreateDeferredTransactionParams</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CredentialMetadataInput.html" data-type="entity-link" >CredentialMetadataInput</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CrlValidationResult.html" data-type="entity-link" >CrlValidationResult</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CryptoImplementation.html" data-type="entity-link" >CryptoImplementation</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/EncryptionKeyProvider.html" data-type="entity-link" >EncryptionKeyProvider</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/FileImportData.html" data-type="entity-link" >FileImportData</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/FileStorage.html" data-type="entity-link" >FileStorage</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/FindCertOptions.html" data-type="entity-link" >FindCertOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/GenerateTokenOptions.html" data-type="entity-link" >GenerateTokenOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ImportableService.html" data-type="entity-link" >ImportableService</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ImportOptions.html" data-type="entity-link" >ImportOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/InteractiveAuthFollowUpRequest.html" data-type="entity-link" >InteractiveAuthFollowUpRequest</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/InteractiveAuthInitialRequest.html" data-type="entity-link" >InteractiveAuthInitialRequest</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/InternalTokenPayload.html" data-type="entity-link" >InternalTokenPayload</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IssuerMetadata.html" data-type="entity-link" >IssuerMetadata</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/JsonSchemaV00.html" data-type="entity-link" >JsonSchemaV00</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Jwk.html" data-type="entity-link" >Jwk</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ListAndSchemeInformation.html" data-type="entity-link" >ListAndSchemeInformation</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/LoTE.html" data-type="entity-link" >LoTE</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/LoTEQualifier.html" data-type="entity-link" >LoTEQualifier</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/MdocErrorDetails.html" data-type="entity-link" >MdocErrorDetails</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/MdocIssueOptions.html" data-type="entity-link" >MdocIssueOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/MultiLangString.html" data-type="entity-link" >MultiLangString</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/NonEmptyMultiLangURI.html" data-type="entity-link" >NonEmptyMultiLangURI</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/OidcDiscoveryDocument.html" data-type="entity-link" >OidcDiscoveryDocument</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/OidcDiscoveryDto.html" data-type="entity-link" >OidcDiscoveryDto</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/OidcDiscoveryDto-1.html" data-type="entity-link" >OidcDiscoveryDto</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/OtherLoTEPointer.html" data-type="entity-link" >OtherLoTEPointer</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ParsedAccessTokenAuthorizationCodeRequestGrant.html" data-type="entity-link" >ParsedAccessTokenAuthorizationCodeRequestGrant</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ParsedAccessTokenPreAuthorizedCodeRequestGrant.html" data-type="entity-link" >ParsedAccessTokenPreAuthorizedCodeRequestGrant</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ParsedAccessTokenRefreshTokenRequestGrant.html" data-type="entity-link" >ParsedAccessTokenRefreshTokenRequestGrant</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ParsedInteractiveAuthorizationRequest.html" data-type="entity-link" >ParsedInteractiveAuthorizationRequest</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/PkiOb.html" data-type="entity-link" >PkiOb</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/PostalAddress.html" data-type="entity-link" >PostalAddress</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/PresentationRequestOptions.html" data-type="entity-link" >PresentationRequestOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/RecordAuditLogInput.html" data-type="entity-link" >RecordAuditLogInput</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/RegisteredImporter.html" data-type="entity-link" >RegisteredImporter</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/RegistrationCertCache.html" data-type="entity-link" >RegistrationCertCache</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/SchemeOperatorAddress.html" data-type="entity-link" >SchemeOperatorAddress</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/SdJwtVcIssueOptions.html" data-type="entity-link" >SdJwtVcIssueOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ServiceDigitalIdentity.html" data-type="entity-link" >ServiceDigitalIdentity</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ServiceHistoryInstance.html" data-type="entity-link" >ServiceHistoryInstance</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ServiceInformation.html" data-type="entity-link" >ServiceInformation</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ServiceSupplyPointURI.html" data-type="entity-link" >ServiceSupplyPointURI</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/SessionEventMessage.html" data-type="entity-link" >SessionEventMessage</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/SessionStatusChangedEvent.html" data-type="entity-link" >SessionStatusChangedEvent</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/StatusCheckResult.html" data-type="entity-link" >StatusCheckResult</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/TEAddress.html" data-type="entity-link" >TEAddress</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Tenants.html" data-type="entity-link" >Tenants</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/TenantSetupFn.html" data-type="entity-link" >TenantSetupFn</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/TlsOptions.html" data-type="entity-link" >TlsOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/TokenPayload.html" data-type="entity-link" >TokenPayload</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/TrustedEntity.html" data-type="entity-link" >TrustedEntity</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/TrustedEntityInformation.html" data-type="entity-link" >TrustedEntityInformation</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/TrustedEntityService.html" data-type="entity-link" >TrustedEntityService</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/VaultKVResponse.html" data-type="entity-link" >VaultKVResponse</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/WebhookResponse.html" data-type="entity-link" >WebhookResponse</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#miscellaneous-links"'
                            : 'data-bs-target="#xs-miscellaneous-links"' }>
                            <span class="icon ion-ios-cube"></span>
                            <span>Miscellaneous</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="miscellaneous-links"' : 'id="xs-miscellaneous-links"' }>
                            <li class="link">
                                <a href="miscellaneous/enumerations.html" data-type="entity-link">Enums</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/functions.html" data-type="entity-link">Functions</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/typealiases.html" data-type="entity-link">Type aliases</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/variables.html" data-type="entity-link">Variables</a>
                            </li>
                        </ul>
                    </li>
                        <li class="chapter">
                            <a data-type="chapter-link" href="routes.html"><span class="icon ion-ios-git-branch"></span>Routes</a>
                        </li>
                    <li class="chapter">
                        <a data-type="chapter-link" href="coverage.html"><span class="icon ion-ios-stats"></span>Documentation coverage</a>
                    </li>
                    <li class="divider"></li>
                    <li class="copyright">
                        Documentation generated using <a href="https://compodoc.app/" target="_blank" rel="noopener noreferrer">
                            <img data-src="images/compodoc-vectorise.png" class="img-responsive" data-type="compodoc-logo">
                        </a>
                    </li>
            </ul>
        </nav>
        `);
        this.innerHTML = tp.strings;
    }
});