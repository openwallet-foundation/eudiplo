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
                ${ isNormalMode ? `<div id="book-search-input" role="search">
    <input type="text" placeholder="Type to search">
    <button type="button"
        class="search-input-clear"
        aria-label="Clear search"
        data-search-input-clear>&times;</button>
</div>
` : '' }
                <li class="chapter">
                    <a data-type="chapter-link" href="index.html"><span class="icon ion-ios-home"></span>Getting started</a>
                    <ul class="links">
                                <li class="link">
                                    <a href="index.html" data-type="chapter-link">
                                        <span class="icon ion-ios-keypad"></span>Overview
                                    </a>
                                </li>

                                <li class="link">
                                    <a href="architecture.html" data-type="chapter-link">
                                        <span class="icon ion-ios-git-branch"></span>Architecture
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
                                <a href="modules/AttributeProviderModule.html" data-type="entity-link" >AttributeProviderModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-AttributeProviderModule-0258a1bca5abda82c2ce8a74e81cdfd4b030036dbdcea1da651db93fd8c0f9164c31000d01b804d1521ea6e7d121a35fc7722de349332a3fc500c629f0a0f5ad"' : 'data-bs-target="#xs-controllers-links-module-AttributeProviderModule-0258a1bca5abda82c2ce8a74e81cdfd4b030036dbdcea1da651db93fd8c0f9164c31000d01b804d1521ea6e7d121a35fc7722de349332a3fc500c629f0a0f5ad"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AttributeProviderModule-0258a1bca5abda82c2ce8a74e81cdfd4b030036dbdcea1da651db93fd8c0f9164c31000d01b804d1521ea6e7d121a35fc7722de349332a3fc500c629f0a0f5ad"' :
                                            'id="xs-controllers-links-module-AttributeProviderModule-0258a1bca5abda82c2ce8a74e81cdfd4b030036dbdcea1da651db93fd8c0f9164c31000d01b804d1521ea6e7d121a35fc7722de349332a3fc500c629f0a0f5ad"' }>
                                            <li class="link">
                                                <a href="controllers/AttributeProviderController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AttributeProviderController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AttributeProviderModule-0258a1bca5abda82c2ce8a74e81cdfd4b030036dbdcea1da651db93fd8c0f9164c31000d01b804d1521ea6e7d121a35fc7722de349332a3fc500c629f0a0f5ad"' : 'data-bs-target="#xs-injectables-links-module-AttributeProviderModule-0258a1bca5abda82c2ce8a74e81cdfd4b030036dbdcea1da651db93fd8c0f9164c31000d01b804d1521ea6e7d121a35fc7722de349332a3fc500c629f0a0f5ad"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AttributeProviderModule-0258a1bca5abda82c2ce8a74e81cdfd4b030036dbdcea1da651db93fd8c0f9164c31000d01b804d1521ea6e7d121a35fc7722de349332a3fc500c629f0a0f5ad"' :
                                        'id="xs-injectables-links-module-AttributeProviderModule-0258a1bca5abda82c2ce8a74e81cdfd4b030036dbdcea1da651db93fd8c0f9164c31000d01b804d1521ea6e7d121a35fc7722de349332a3fc500c629f0a0f5ad"' }>
                                        <li class="link">
                                            <a href="injectables/AttributeProviderService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AttributeProviderService</a>
                                        </li>
                                    </ul>
                                </li>
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
                                <a href="modules/AuthorizationModule.html" data-type="entity-link" >AuthorizationModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-AuthorizationModule-e3bbc797573cc709bba56f857e0ae89108c1f3bc93ebcc6f3245b65d51d441de42bbcb8c69a3a8b52c398adacabadf5f7451bd25aa669cf1afecfd4f895d7cb4"' : 'data-bs-target="#xs-controllers-links-module-AuthorizationModule-e3bbc797573cc709bba56f857e0ae89108c1f3bc93ebcc6f3245b65d51d441de42bbcb8c69a3a8b52c398adacabadf5f7451bd25aa669cf1afecfd4f895d7cb4"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AuthorizationModule-e3bbc797573cc709bba56f857e0ae89108c1f3bc93ebcc6f3245b65d51d441de42bbcb8c69a3a8b52c398adacabadf5f7451bd25aa669cf1afecfd4f895d7cb4"' :
                                            'id="xs-controllers-links-module-AuthorizationModule-e3bbc797573cc709bba56f857e0ae89108c1f3bc93ebcc6f3245b65d51d441de42bbcb8c69a3a8b52c398adacabadf5f7451bd25aa669cf1afecfd4f895d7cb4"' }>
                                            <li class="link">
                                                <a href="controllers/AuthorizationServersController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthorizationServersController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/AuthorizeController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthorizeController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/ChainedAsController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ChainedAsController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/ChainedAsVpController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ChainedAsVpController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/InteractiveAuthorizationController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >InteractiveAuthorizationController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AuthorizationModule-e3bbc797573cc709bba56f857e0ae89108c1f3bc93ebcc6f3245b65d51d441de42bbcb8c69a3a8b52c398adacabadf5f7451bd25aa669cf1afecfd4f895d7cb4"' : 'data-bs-target="#xs-injectables-links-module-AuthorizationModule-e3bbc797573cc709bba56f857e0ae89108c1f3bc93ebcc6f3245b65d51d441de42bbcb8c69a3a8b52c398adacabadf5f7451bd25aa669cf1afecfd4f895d7cb4"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AuthorizationModule-e3bbc797573cc709bba56f857e0ae89108c1f3bc93ebcc6f3245b65d51d441de42bbcb8c69a3a8b52c398adacabadf5f7451bd25aa669cf1afecfd4f895d7cb4"' :
                                        'id="xs-injectables-links-module-AuthorizationModule-e3bbc797573cc709bba56f857e0ae89108c1f3bc93ebcc6f3245b65d51d441de42bbcb8c69a3a8b52c398adacabadf5f7451bd25aa669cf1afecfd4f895d7cb4"' }>
                                        <li class="link">
                                            <a href="injectables/AuthorizationServersService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthorizationServersService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/AuthorizeService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthorizeService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ChainedAsService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ChainedAsService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ChainedAsVpService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ChainedAsVpService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/InteractiveAuthorizationService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >InteractiveAuthorizationService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/ClientModule.html" data-type="entity-link" >ClientModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-ClientModule-79de8e2663aa3f3fc84b06262f06bf04792f2902941edc6f5fb81cf24b94f6c5b56094fd1f494735d2d9a4fbf4b11eb54cc337dbf92b0ad5a08937fdef870589"' : 'data-bs-target="#xs-controllers-links-module-ClientModule-79de8e2663aa3f3fc84b06262f06bf04792f2902941edc6f5fb81cf24b94f6c5b56094fd1f494735d2d9a4fbf4b11eb54cc337dbf92b0ad5a08937fdef870589"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-ClientModule-79de8e2663aa3f3fc84b06262f06bf04792f2902941edc6f5fb81cf24b94f6c5b56094fd1f494735d2d9a4fbf4b11eb54cc337dbf92b0ad5a08937fdef870589"' :
                                            'id="xs-controllers-links-module-ClientModule-79de8e2663aa3f3fc84b06262f06bf04792f2902941edc6f5fb81cf24b94f6c5b56094fd1f494735d2d9a4fbf4b11eb54cc337dbf92b0ad5a08937fdef870589"' }>
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
                                        'data-bs-target="#injectables-links-module-ConfigImportModule-4f1b2a0a9780edbeab1d0c9c150ac7b03acaf5dd76d769654f2ef4e4b528fe199e54ad45fb66391d407db7b1a0a968c235e4d4fd5fb146bb98c0fcad82311d41"' : 'data-bs-target="#xs-injectables-links-module-ConfigImportModule-4f1b2a0a9780edbeab1d0c9c150ac7b03acaf5dd76d769654f2ef4e4b528fe199e54ad45fb66391d407db7b1a0a968c235e4d4fd5fb146bb98c0fcad82311d41"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-ConfigImportModule-4f1b2a0a9780edbeab1d0c9c150ac7b03acaf5dd76d769654f2ef4e4b528fe199e54ad45fb66391d407db7b1a0a968c235e4d4fd5fb146bb98c0fcad82311d41"' :
                                        'id="xs-injectables-links-module-ConfigImportModule-4f1b2a0a9780edbeab1d0c9c150ac7b03acaf5dd76d769654f2ef4e4b528fe199e54ad45fb66391d407db7b1a0a968c235e4d4fd5fb146bb98c0fcad82311d41"' }>
                                        <li class="link">
                                            <a href="injectables/ConfigImportModeService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigImportModeService</a>
                                        </li>
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
                                <a href="modules/ConfigPortabilityModule.html" data-type="entity-link" >ConfigPortabilityModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-ConfigPortabilityModule-963c1f6976fa83d8a1d808acba7f89d058b79d3c3f9023302db70bf6078ce70dc8ad87a7e03aa65a6d24d40ca0c9601d2ac59512e1500652f40a76e8bfc14678"' : 'data-bs-target="#xs-controllers-links-module-ConfigPortabilityModule-963c1f6976fa83d8a1d808acba7f89d058b79d3c3f9023302db70bf6078ce70dc8ad87a7e03aa65a6d24d40ca0c9601d2ac59512e1500652f40a76e8bfc14678"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-ConfigPortabilityModule-963c1f6976fa83d8a1d808acba7f89d058b79d3c3f9023302db70bf6078ce70dc8ad87a7e03aa65a6d24d40ca0c9601d2ac59512e1500652f40a76e8bfc14678"' :
                                            'id="xs-controllers-links-module-ConfigPortabilityModule-963c1f6976fa83d8a1d808acba7f89d058b79d3c3f9023302db70bf6078ce70dc8ad87a7e03aa65a6d24d40ca0c9601d2ac59512e1500652f40a76e8bfc14678"' }>
                                            <li class="link">
                                                <a href="controllers/ConfigPortabilityController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigPortabilityController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-ConfigPortabilityModule-963c1f6976fa83d8a1d808acba7f89d058b79d3c3f9023302db70bf6078ce70dc8ad87a7e03aa65a6d24d40ca0c9601d2ac59512e1500652f40a76e8bfc14678"' : 'data-bs-target="#xs-injectables-links-module-ConfigPortabilityModule-963c1f6976fa83d8a1d808acba7f89d058b79d3c3f9023302db70bf6078ce70dc8ad87a7e03aa65a6d24d40ca0c9601d2ac59512e1500652f40a76e8bfc14678"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-ConfigPortabilityModule-963c1f6976fa83d8a1d808acba7f89d058b79d3c3f9023302db70bf6078ce70dc8ad87a7e03aa65a6d24d40ca0c9601d2ac59512e1500652f40a76e8bfc14678"' :
                                        'id="xs-injectables-links-module-ConfigPortabilityModule-963c1f6976fa83d8a1d808acba7f89d058b79d3c3f9023302db70bf6078ce70dc8ad87a7e03aa65a6d24d40ca0c9601d2ac59512e1500652f40a76e8bfc14678"' }>
                                        <li class="link">
                                            <a href="injectables/ConfigBundleApplyService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigBundleApplyService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ConfigBundleArchiveService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigBundleArchiveService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ConfigBundleService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigBundleService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ConfigDocumentValidationService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigDocumentValidationService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ConfigFolderBundleService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigFolderBundleService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ConfigGenerationInterceptor.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigGenerationInterceptor</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ConfigKmsReferenceService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigKmsReferenceService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ConfigOwnershipBootstrapService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigOwnershipBootstrapService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ConfigOwnershipService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigOwnershipService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ConfigResourceRouteService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigResourceRouteService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/ConfigResourceCoreModule.html" data-type="entity-link" >ConfigResourceCoreModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-ConfigResourceCoreModule-a176a6972424af2a6a298549bfb945e1074196cb4864da6ac3c394ac0c5bb95f7ebafce22d7adb30af7fa5d6336e99c316aa438cec9b0ccd99df8bf7d93b2fe4"' : 'data-bs-target="#xs-injectables-links-module-ConfigResourceCoreModule-a176a6972424af2a6a298549bfb945e1074196cb4864da6ac3c394ac0c5bb95f7ebafce22d7adb30af7fa5d6336e99c316aa438cec9b0ccd99df8bf7d93b2fe4"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-ConfigResourceCoreModule-a176a6972424af2a6a298549bfb945e1074196cb4864da6ac3c394ac0c5bb95f7ebafce22d7adb30af7fa5d6336e99c316aa438cec9b0ccd99df8bf7d93b2fe4"' :
                                        'id="xs-injectables-links-module-ConfigResourceCoreModule-a176a6972424af2a6a298549bfb945e1074196cb4864da6ac3c394ac0c5bb95f7ebafce22d7adb30af7fa5d6336e99c316aa438cec9b0ccd99df8bf7d93b2fe4"' }>
                                        <li class="link">
                                            <a href="injectables/ConfigMigrationService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigMigrationService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ConfigResourceRegistry.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigResourceRegistry</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/ConfigurationModule.html" data-type="entity-link" >ConfigurationModule</a>
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
                                <a href="modules/CredentialConfigModule.html" data-type="entity-link" >CredentialConfigModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-CredentialConfigModule-7d1172a18c82156f1d7ceffda229657183df128a52c8c2d5b9c34dfa9ef8347f1d7c4d6947103022e4e42ae9a484df8767227f548017db2c844775247d21cb9a"' : 'data-bs-target="#xs-controllers-links-module-CredentialConfigModule-7d1172a18c82156f1d7ceffda229657183df128a52c8c2d5b9c34dfa9ef8347f1d7c4d6947103022e4e42ae9a484df8767227f548017db2c844775247d21cb9a"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-CredentialConfigModule-7d1172a18c82156f1d7ceffda229657183df128a52c8c2d5b9c34dfa9ef8347f1d7c4d6947103022e4e42ae9a484df8767227f548017db2c844775247d21cb9a"' :
                                            'id="xs-controllers-links-module-CredentialConfigModule-7d1172a18c82156f1d7ceffda229657183df128a52c8c2d5b9c34dfa9ef8347f1d7c4d6947103022e4e42ae9a484df8767227f548017db2c844775247d21cb9a"' }>
                                            <li class="link">
                                                <a href="controllers/CredentialConfigController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CredentialConfigController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-CredentialConfigModule-7d1172a18c82156f1d7ceffda229657183df128a52c8c2d5b9c34dfa9ef8347f1d7c4d6947103022e4e42ae9a484df8767227f548017db2c844775247d21cb9a"' : 'data-bs-target="#xs-injectables-links-module-CredentialConfigModule-7d1172a18c82156f1d7ceffda229657183df128a52c8c2d5b9c34dfa9ef8347f1d7c4d6947103022e4e42ae9a484df8767227f548017db2c844775247d21cb9a"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-CredentialConfigModule-7d1172a18c82156f1d7ceffda229657183df128a52c8c2d5b9c34dfa9ef8347f1d7c4d6947103022e4e42ae9a484df8767227f548017db2c844775247d21cb9a"' :
                                        'id="xs-injectables-links-module-CredentialConfigModule-7d1172a18c82156f1d7ceffda229657183df128a52c8c2d5b9c34dfa9ef8347f1d7c4d6947103022e4e42ae9a484df8767227f548017db2c844775247d21cb9a"' }>
                                        <li class="link">
                                            <a href="injectables/CredentialConfigService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CredentialConfigService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/CredentialIssuanceModule.html" data-type="entity-link" >CredentialIssuanceModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-CredentialIssuanceModule-99ec082013ce9ebd07631bd27a7203740cd457190f6a93a6bd6ebb04341a302938a0c04783f37fb62020a8adc4df1d427b4f882941a29436227d19d757f0bda2"' : 'data-bs-target="#xs-injectables-links-module-CredentialIssuanceModule-99ec082013ce9ebd07631bd27a7203740cd457190f6a93a6bd6ebb04341a302938a0c04783f37fb62020a8adc4df1d427b4f882941a29436227d19d757f0bda2"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-CredentialIssuanceModule-99ec082013ce9ebd07631bd27a7203740cd457190f6a93a6bd6ebb04341a302938a0c04783f37fb62020a8adc4df1d427b4f882941a29436227d19d757f0bda2"' :
                                        'id="xs-injectables-links-module-CredentialIssuanceModule-99ec082013ce9ebd07631bd27a7203740cd457190f6a93a6bd6ebb04341a302938a0c04783f37fb62020a8adc4df1d427b4f882941a29436227d19d757f0bda2"' }>
                                        <li class="link">
                                            <a href="injectables/CredentialsService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CredentialsService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/MdocIssuerService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >MdocIssuerService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/SdjwtvcIssuerService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SdjwtvcIssuerService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/CryptoImplementationModule.html" data-type="entity-link" >CryptoImplementationModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-CryptoImplementationModule-bd728b18fe7dfc5cb050b6c00aba31881db5ac4870f9cd931426078844213400b8e2e39631ccf941855fd6518b0a763e8f48362e1a037b71ab3524e3dfb52355"' : 'data-bs-target="#xs-injectables-links-module-CryptoImplementationModule-bd728b18fe7dfc5cb050b6c00aba31881db5ac4870f9cd931426078844213400b8e2e39631ccf941855fd6518b0a763e8f48362e1a037b71ab3524e3dfb52355"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-CryptoImplementationModule-bd728b18fe7dfc5cb050b6c00aba31881db5ac4870f9cd931426078844213400b8e2e39631ccf941855fd6518b0a763e8f48362e1a037b71ab3524e3dfb52355"' :
                                        'id="xs-injectables-links-module-CryptoImplementationModule-bd728b18fe7dfc5cb050b6c00aba31881db5ac4870f9cd931426078844213400b8e2e39631ccf941855fd6518b0a763e8f48362e1a037b71ab3524e3dfb52355"' }>
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
                                <a href="modules/DataEncryptionModule.html" data-type="entity-link" >DataEncryptionModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-DataEncryptionModule-1b88c574dcddbba2980c38e7878aa2adf30fc7e84caa4b1bb8f6592f3426542d35504f754f382aa566cdabbe8ffc82f40242149af508ccfedf975dc6bd568c5a"' : 'data-bs-target="#xs-injectables-links-module-DataEncryptionModule-1b88c574dcddbba2980c38e7878aa2adf30fc7e84caa4b1bb8f6592f3426542d35504f754f382aa566cdabbe8ffc82f40242149af508ccfedf975dc6bd568c5a"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-DataEncryptionModule-1b88c574dcddbba2980c38e7878aa2adf30fc7e84caa4b1bb8f6592f3426542d35504f754f382aa566cdabbe8ffc82f40242149af508ccfedf975dc6bd568c5a"' :
                                        'id="xs-injectables-links-module-DataEncryptionModule-1b88c574dcddbba2980c38e7878aa2adf30fc7e84caa4b1bb8f6592f3426542d35504f754f382aa566cdabbe8ffc82f40242149af508ccfedf975dc6bd568c5a"' }>
                                        <li class="link">
                                            <a href="injectables/DataEncryptionService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DataEncryptionService</a>
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
                                <a href="modules/Iso18013Module.html" data-type="entity-link" >Iso18013Module</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-Iso18013Module-34da59fc8a48558eca304ab103e943cab2875cf9ef47be172734eb53e4f3b6e905bd7a3ddb1b84518f4703699ae3e8bdc5901dcbe2b872651d6082f23b332147"' : 'data-bs-target="#xs-controllers-links-module-Iso18013Module-34da59fc8a48558eca304ab103e943cab2875cf9ef47be172734eb53e4f3b6e905bd7a3ddb1b84518f4703699ae3e8bdc5901dcbe2b872651d6082f23b332147"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-Iso18013Module-34da59fc8a48558eca304ab103e943cab2875cf9ef47be172734eb53e4f3b6e905bd7a3ddb1b84518f4703699ae3e8bdc5901dcbe2b872651d6082f23b332147"' :
                                            'id="xs-controllers-links-module-Iso18013Module-34da59fc8a48558eca304ab103e943cab2875cf9ef47be172734eb53e4f3b6e905bd7a3ddb1b84518f4703699ae3e8bdc5901dcbe2b872651d6082f23b332147"' }>
                                            <li class="link">
                                                <a href="controllers/Iso18013Controller.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >Iso18013Controller</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-Iso18013Module-34da59fc8a48558eca304ab103e943cab2875cf9ef47be172734eb53e4f3b6e905bd7a3ddb1b84518f4703699ae3e8bdc5901dcbe2b872651d6082f23b332147"' : 'data-bs-target="#xs-injectables-links-module-Iso18013Module-34da59fc8a48558eca304ab103e943cab2875cf9ef47be172734eb53e4f3b6e905bd7a3ddb1b84518f4703699ae3e8bdc5901dcbe2b872651d6082f23b332147"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-Iso18013Module-34da59fc8a48558eca304ab103e943cab2875cf9ef47be172734eb53e4f3b6e905bd7a3ddb1b84518f4703699ae3e8bdc5901dcbe2b872651d6082f23b332147"' :
                                        'id="xs-injectables-links-module-Iso18013Module-34da59fc8a48558eca304ab103e943cab2875cf9ef47be172734eb53e4f3b6e905bd7a3ddb1b84518f4703699ae3e8bdc5901dcbe2b872651d6082f23b332147"' }>
                                        <li class="link">
                                            <a href="injectables/Iso18013Service.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >Iso18013Service</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/IssuanceConfigModule.html" data-type="entity-link" >IssuanceConfigModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-IssuanceConfigModule-97fd6e4031b61f604f7da84e52143bdefd41a6e9ba783c0a606216861c3b59f4f328c055ad485d1a17113186d55c87e9ee1abe504c75ead47f78038343d429da"' : 'data-bs-target="#xs-controllers-links-module-IssuanceConfigModule-97fd6e4031b61f604f7da84e52143bdefd41a6e9ba783c0a606216861c3b59f4f328c055ad485d1a17113186d55c87e9ee1abe504c75ead47f78038343d429da"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-IssuanceConfigModule-97fd6e4031b61f604f7da84e52143bdefd41a6e9ba783c0a606216861c3b59f4f328c055ad485d1a17113186d55c87e9ee1abe504c75ead47f78038343d429da"' :
                                            'id="xs-controllers-links-module-IssuanceConfigModule-97fd6e4031b61f604f7da84e52143bdefd41a6e9ba783c0a606216861c3b59f4f328c055ad485d1a17113186d55c87e9ee1abe504c75ead47f78038343d429da"' }>
                                            <li class="link">
                                                <a href="controllers/IssuanceConfigController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >IssuanceConfigController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-IssuanceConfigModule-97fd6e4031b61f604f7da84e52143bdefd41a6e9ba783c0a606216861c3b59f4f328c055ad485d1a17113186d55c87e9ee1abe504c75ead47f78038343d429da"' : 'data-bs-target="#xs-injectables-links-module-IssuanceConfigModule-97fd6e4031b61f604f7da84e52143bdefd41a6e9ba783c0a606216861c3b59f4f328c055ad485d1a17113186d55c87e9ee1abe504c75ead47f78038343d429da"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-IssuanceConfigModule-97fd6e4031b61f604f7da84e52143bdefd41a6e9ba783c0a606216861c3b59f4f328c055ad485d1a17113186d55c87e9ee1abe504c75ead47f78038343d429da"' :
                                        'id="xs-injectables-links-module-IssuanceConfigModule-97fd6e4031b61f604f7da84e52143bdefd41a6e9ba783c0a606216861c3b59f4f328c055ad485d1a17113186d55c87e9ee1abe504c75ead47f78038343d429da"' }>
                                        <li class="link">
                                            <a href="injectables/IssuanceService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >IssuanceService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/IssuanceModule.html" data-type="entity-link" >IssuanceModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-IssuanceModule-57e7b9eaa4f26eb8d4b9b8eb5c3a6281f01421e90691aafc1d5f9d64661f53a0962848292c8a63be4163d230f031a8cb834cb1eefbf06bc08542d4092e403349"' : 'data-bs-target="#xs-controllers-links-module-IssuanceModule-57e7b9eaa4f26eb8d4b9b8eb5c3a6281f01421e90691aafc1d5f9d64661f53a0962848292c8a63be4163d230f031a8cb834cb1eefbf06bc08542d4092e403349"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-IssuanceModule-57e7b9eaa4f26eb8d4b9b8eb5c3a6281f01421e90691aafc1d5f9d64661f53a0962848292c8a63be4163d230f031a8cb834cb1eefbf06bc08542d4092e403349"' :
                                            'id="xs-controllers-links-module-IssuanceModule-57e7b9eaa4f26eb8d4b9b8eb5c3a6281f01421e90691aafc1d5f9d64661f53a0962848292c8a63be4163d230f031a8cb834cb1eefbf06bc08542d4092e403349"' }>
                                            <li class="link">
                                                <a href="controllers/CredentialOfferController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CredentialOfferController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/DeferredController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DeferredController</a>
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
                                        'data-bs-target="#injectables-links-module-IssuanceModule-57e7b9eaa4f26eb8d4b9b8eb5c3a6281f01421e90691aafc1d5f9d64661f53a0962848292c8a63be4163d230f031a8cb834cb1eefbf06bc08542d4092e403349"' : 'data-bs-target="#xs-injectables-links-module-IssuanceModule-57e7b9eaa4f26eb8d4b9b8eb5c3a6281f01421e90691aafc1d5f9d64661f53a0962848292c8a63be4163d230f031a8cb834cb1eefbf06bc08542d4092e403349"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-IssuanceModule-57e7b9eaa4f26eb8d4b9b8eb5c3a6281f01421e90691aafc1d5f9d64661f53a0962848292c8a63be4163d230f031a8cb834cb1eefbf06bc08542d4092e403349"' :
                                        'id="xs-injectables-links-module-IssuanceModule-57e7b9eaa4f26eb8d4b9b8eb5c3a6281f01421e90691aafc1d5f9d64661f53a0962848292c8a63be4163d230f031a8cb834cb1eefbf06bc08542d4092e403349"' }>
                                        <li class="link">
                                            <a href="injectables/DeferredCredentialService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DeferredCredentialService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/NonceService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >NonceService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/Oid4vciService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >Oid4vciService</a>
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
                                <a href="modules/Oid4vpModule.html" data-type="entity-link" >Oid4vpModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-Oid4vpModule-90a7e17f5f40e190dc3286e10a96af662405ee3d356e56c3362f6285f68c3ebe57d0a9143664f7278bc8b92fdd3acd3f464abdfedeb350ea441ea28add81f40a"' : 'data-bs-target="#xs-controllers-links-module-Oid4vpModule-90a7e17f5f40e190dc3286e10a96af662405ee3d356e56c3362f6285f68c3ebe57d0a9143664f7278bc8b92fdd3acd3f464abdfedeb350ea441ea28add81f40a"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-Oid4vpModule-90a7e17f5f40e190dc3286e10a96af662405ee3d356e56c3362f6285f68c3ebe57d0a9143664f7278bc8b92fdd3acd3f464abdfedeb350ea441ea28add81f40a"' :
                                            'id="xs-controllers-links-module-Oid4vpModule-90a7e17f5f40e190dc3286e10a96af662405ee3d356e56c3362f6285f68c3ebe57d0a9143664f7278bc8b92fdd3acd3f464abdfedeb350ea441ea28add81f40a"' }>
                                            <li class="link">
                                                <a href="controllers/Oid4vpController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >Oid4vpController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-Oid4vpModule-90a7e17f5f40e190dc3286e10a96af662405ee3d356e56c3362f6285f68c3ebe57d0a9143664f7278bc8b92fdd3acd3f464abdfedeb350ea441ea28add81f40a"' : 'data-bs-target="#xs-injectables-links-module-Oid4vpModule-90a7e17f5f40e190dc3286e10a96af662405ee3d356e56c3362f6285f68c3ebe57d0a9143664f7278bc8b92fdd3acd3f464abdfedeb350ea441ea28add81f40a"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-Oid4vpModule-90a7e17f5f40e190dc3286e10a96af662405ee3d356e56c3362f6285f68c3ebe57d0a9143664f7278bc8b92fdd3acd3f464abdfedeb350ea441ea28add81f40a"' :
                                        'id="xs-injectables-links-module-Oid4vpModule-90a7e17f5f40e190dc3286e10a96af662405ee3d356e56c3362f6285f68c3ebe57d0a9143664f7278bc8b92fdd3acd3f464abdfedeb350ea441ea28add81f40a"' }>
                                        <li class="link">
                                            <a href="injectables/Oid4vpService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >Oid4vpService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/PresentationsModule.html" data-type="entity-link" >PresentationsModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-PresentationsModule-e586daa5a90768d38092d66a7d3dea788b65c1031ea735e4bb403b4e10de93466c906eb851a4224e84e66f5a4b6c324d8f9f2c70825c85c8f80c9cddd95f6741"' : 'data-bs-target="#xs-controllers-links-module-PresentationsModule-e586daa5a90768d38092d66a7d3dea788b65c1031ea735e4bb403b4e10de93466c906eb851a4224e84e66f5a4b6c324d8f9f2c70825c85c8f80c9cddd95f6741"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-PresentationsModule-e586daa5a90768d38092d66a7d3dea788b65c1031ea735e4bb403b4e10de93466c906eb851a4224e84e66f5a4b6c324d8f9f2c70825c85c8f80c9cddd95f6741"' :
                                            'id="xs-controllers-links-module-PresentationsModule-e586daa5a90768d38092d66a7d3dea788b65c1031ea735e4bb403b4e10de93466c906eb851a4224e84e66f5a4b6c324d8f9f2c70825c85c8f80c9cddd95f6741"' }>
                                            <li class="link">
                                                <a href="controllers/PresentationManagementController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >PresentationManagementController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-PresentationsModule-e586daa5a90768d38092d66a7d3dea788b65c1031ea735e4bb403b4e10de93466c906eb851a4224e84e66f5a4b6c324d8f9f2c70825c85c8f80c9cddd95f6741"' : 'data-bs-target="#xs-injectables-links-module-PresentationsModule-e586daa5a90768d38092d66a7d3dea788b65c1031ea735e4bb403b4e10de93466c906eb851a4224e84e66f5a4b6c324d8f9f2c70825c85c8f80c9cddd95f6741"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-PresentationsModule-e586daa5a90768d38092d66a7d3dea788b65c1031ea735e4bb403b4e10de93466c906eb851a4224e84e66f5a4b6c324d8f9f2c70825c85c8f80c9cddd95f6741"' :
                                        'id="xs-injectables-links-module-PresentationsModule-e586daa5a90768d38092d66a7d3dea788b65c1031ea735e4bb403b4e10de93466c906eb851a4224e84e66f5a4b6c324d8f9f2c70825c85c8f80c9cddd95f6741"' }>
                                        <li class="link">
                                            <a href="injectables/CredentialChainValidationService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CredentialChainValidationService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/MdocverifierService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >MdocverifierService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/MetadataFetchService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >MetadataFetchService</a>
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
                                            'data-bs-target="#controllers-links-module-RegistrarModule-fb88cc99efcc55c74947a0b2ddfe0c341fb40ad2f852904967089535720126033f237e50e03aaef6a0c1ef94a3ad7afeccf29821f77903f582c09323d7ac734c"' : 'data-bs-target="#xs-controllers-links-module-RegistrarModule-fb88cc99efcc55c74947a0b2ddfe0c341fb40ad2f852904967089535720126033f237e50e03aaef6a0c1ef94a3ad7afeccf29821f77903f582c09323d7ac734c"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-RegistrarModule-fb88cc99efcc55c74947a0b2ddfe0c341fb40ad2f852904967089535720126033f237e50e03aaef6a0c1ef94a3ad7afeccf29821f77903f582c09323d7ac734c"' :
                                            'id="xs-controllers-links-module-RegistrarModule-fb88cc99efcc55c74947a0b2ddfe0c341fb40ad2f852904967089535720126033f237e50e03aaef6a0c1ef94a3ad7afeccf29821f77903f582c09323d7ac734c"' }>
                                            <li class="link">
                                                <a href="controllers/RegistrarController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RegistrarController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-RegistrarModule-fb88cc99efcc55c74947a0b2ddfe0c341fb40ad2f852904967089535720126033f237e50e03aaef6a0c1ef94a3ad7afeccf29821f77903f582c09323d7ac734c"' : 'data-bs-target="#xs-injectables-links-module-RegistrarModule-fb88cc99efcc55c74947a0b2ddfe0c341fb40ad2f852904967089535720126033f237e50e03aaef6a0c1ef94a3ad7afeccf29821f77903f582c09323d7ac734c"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-RegistrarModule-fb88cc99efcc55c74947a0b2ddfe0c341fb40ad2f852904967089535720126033f237e50e03aaef6a0c1ef94a3ad7afeccf29821f77903f582c09323d7ac734c"' :
                                        'id="xs-injectables-links-module-RegistrarModule-fb88cc99efcc55c74947a0b2ddfe0c341fb40ad2f852904967089535720126033f237e50e03aaef6a0c1ef94a3ad7afeccf29821f77903f582c09323d7ac734c"' }>
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
                                <a href="modules/SchemaMetadataModule.html" data-type="entity-link" >SchemaMetadataModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-SchemaMetadataModule-b0692879bbd6d611fe1aa9ed9a7ed2678fedf9c26031c5c77af432bd0545e38888a4dd69c2eb9333e6cca86fc6dac80f0053e72e8e15487d5c3a011407f23f28"' : 'data-bs-target="#xs-controllers-links-module-SchemaMetadataModule-b0692879bbd6d611fe1aa9ed9a7ed2678fedf9c26031c5c77af432bd0545e38888a4dd69c2eb9333e6cca86fc6dac80f0053e72e8e15487d5c3a011407f23f28"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-SchemaMetadataModule-b0692879bbd6d611fe1aa9ed9a7ed2678fedf9c26031c5c77af432bd0545e38888a4dd69c2eb9333e6cca86fc6dac80f0053e72e8e15487d5c3a011407f23f28"' :
                                            'id="xs-controllers-links-module-SchemaMetadataModule-b0692879bbd6d611fe1aa9ed9a7ed2678fedf9c26031c5c77af432bd0545e38888a4dd69c2eb9333e6cca86fc6dac80f0053e72e8e15487d5c3a011407f23f28"' }>
                                            <li class="link">
                                                <a href="controllers/SchemaMetadataController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SchemaMetadataController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-SchemaMetadataModule-b0692879bbd6d611fe1aa9ed9a7ed2678fedf9c26031c5c77af432bd0545e38888a4dd69c2eb9333e6cca86fc6dac80f0053e72e8e15487d5c3a011407f23f28"' : 'data-bs-target="#xs-injectables-links-module-SchemaMetadataModule-b0692879bbd6d611fe1aa9ed9a7ed2678fedf9c26031c5c77af432bd0545e38888a4dd69c2eb9333e6cca86fc6dac80f0053e72e8e15487d5c3a011407f23f28"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-SchemaMetadataModule-b0692879bbd6d611fe1aa9ed9a7ed2678fedf9c26031c5c77af432bd0545e38888a4dd69c2eb9333e6cca86fc6dac80f0053e72e8e15487d5c3a011407f23f28"' :
                                        'id="xs-injectables-links-module-SchemaMetadataModule-b0692879bbd6d611fe1aa9ed9a7ed2678fedf9c26031c5c77af432bd0545e38888a4dd69c2eb9333e6cca86fc6dac80f0053e72e8e15487d5c3a011407f23f28"' }>
                                        <li class="link">
                                            <a href="injectables/SchemaMetadataSubmissionService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SchemaMetadataSubmissionService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/SessionLoggingModule.html" data-type="entity-link" >SessionLoggingModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-SessionLoggingModule-3b1fa394331c4bd1a89c51a223fe7cfc1c9375d484cd1f348af086464d3187a9575b641a6005851c9b2632bac59724abcaaa6b0f3d9eacdcb1ac59d25fa169c0"' : 'data-bs-target="#xs-injectables-links-module-SessionLoggingModule-3b1fa394331c4bd1a89c51a223fe7cfc1c9375d484cd1f348af086464d3187a9575b641a6005851c9b2632bac59724abcaaa6b0f3d9eacdcb1ac59d25fa169c0"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-SessionLoggingModule-3b1fa394331c4bd1a89c51a223fe7cfc1c9375d484cd1f348af086464d3187a9575b641a6005851c9b2632bac59724abcaaa6b0f3d9eacdcb1ac59d25fa169c0"' :
                                        'id="xs-injectables-links-module-SessionLoggingModule-3b1fa394331c4bd1a89c51a223fe7cfc1c9375d484cd1f348af086464d3187a9575b641a6005851c9b2632bac59724abcaaa6b0f3d9eacdcb1ac59d25fa169c0"' }>
                                        <li class="link">
                                            <a href="injectables/SessionAuditService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionAuditService</a>
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
                                <a href="modules/SessionModule.html" data-type="entity-link" >SessionModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-SessionModule-561a2577eb5badec2687f94add24a01e44e43ed5177d74f57f43463e605b8649f6cd8176837d271d1796da4b303ada0eef77dc04d2ab51902a67229e4e7f1c76"' : 'data-bs-target="#xs-controllers-links-module-SessionModule-561a2577eb5badec2687f94add24a01e44e43ed5177d74f57f43463e605b8649f6cd8176837d271d1796da4b303ada0eef77dc04d2ab51902a67229e4e7f1c76"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-SessionModule-561a2577eb5badec2687f94add24a01e44e43ed5177d74f57f43463e605b8649f6cd8176837d271d1796da4b303ada0eef77dc04d2ab51902a67229e4e7f1c76"' :
                                            'id="xs-controllers-links-module-SessionModule-561a2577eb5badec2687f94add24a01e44e43ed5177d74f57f43463e605b8649f6cd8176837d271d1796da4b303ada0eef77dc04d2ab51902a67229e4e7f1c76"' }>
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
                                        'data-bs-target="#injectables-links-module-SessionModule-561a2577eb5badec2687f94add24a01e44e43ed5177d74f57f43463e605b8649f6cd8176837d271d1796da4b303ada0eef77dc04d2ab51902a67229e4e7f1c76"' : 'data-bs-target="#xs-injectables-links-module-SessionModule-561a2577eb5badec2687f94add24a01e44e43ed5177d74f57f43463e605b8649f6cd8176837d271d1796da4b303ada0eef77dc04d2ab51902a67229e4e7f1c76"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-SessionModule-561a2577eb5badec2687f94add24a01e44e43ed5177d74f57f43463e605b8649f6cd8176837d271d1796da4b303ada0eef77dc04d2ab51902a67229e4e7f1c76"' :
                                        'id="xs-injectables-links-module-SessionModule-561a2577eb5badec2687f94add24a01e44e43ed5177d74f57f43463e605b8649f6cd8176837d271d1796da4b303ada0eef77dc04d2ab51902a67229e4e7f1c76"' }>
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
                                <a href="modules/StatusListModule.html" data-type="entity-link" >StatusListModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-StatusListModule-63dfcfd61b0eb00bd82046f874fc2f67997a64dbbf0a3d355040ae3de99e2da90de8e8d50e45e2a149680a17901c032fa29679d3161f905172b94a9a4c784242"' : 'data-bs-target="#xs-controllers-links-module-StatusListModule-63dfcfd61b0eb00bd82046f874fc2f67997a64dbbf0a3d355040ae3de99e2da90de8e8d50e45e2a149680a17901c032fa29679d3161f905172b94a9a4c784242"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-StatusListModule-63dfcfd61b0eb00bd82046f874fc2f67997a64dbbf0a3d355040ae3de99e2da90de8e8d50e45e2a149680a17901c032fa29679d3161f905172b94a9a4c784242"' :
                                            'id="xs-controllers-links-module-StatusListModule-63dfcfd61b0eb00bd82046f874fc2f67997a64dbbf0a3d355040ae3de99e2da90de8e8d50e45e2a149680a17901c032fa29679d3161f905172b94a9a4c784242"' }>
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
                                        'data-bs-target="#injectables-links-module-StatusListModule-63dfcfd61b0eb00bd82046f874fc2f67997a64dbbf0a3d355040ae3de99e2da90de8e8d50e45e2a149680a17901c032fa29679d3161f905172b94a9a4c784242"' : 'data-bs-target="#xs-injectables-links-module-StatusListModule-63dfcfd61b0eb00bd82046f874fc2f67997a64dbbf0a3d355040ae3de99e2da90de8e8d50e45e2a149680a17901c032fa29679d3161f905172b94a9a4c784242"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-StatusListModule-63dfcfd61b0eb00bd82046f874fc2f67997a64dbbf0a3d355040ae3de99e2da90de8e8d50e45e2a149680a17901c032fa29679d3161f905172b94a9a4c784242"' :
                                        'id="xs-injectables-links-module-StatusListModule-63dfcfd61b0eb00bd82046f874fc2f67997a64dbbf0a3d355040ae3de99e2da90de8e8d50e45e2a149680a17901c032fa29679d3161f905172b94a9a4c784242"' }>
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
                                            'data-bs-target="#controllers-links-module-TenantModule-7315c7432d94bcb2f828560d0c8328f211d704be7375918d3b00b267f5b0ae9fd19372f36b786cdf7e61a32e1c2d05b2d96fa70aaf500b29cd9cdece673387a2"' : 'data-bs-target="#xs-controllers-links-module-TenantModule-7315c7432d94bcb2f828560d0c8328f211d704be7375918d3b00b267f5b0ae9fd19372f36b786cdf7e61a32e1c2d05b2d96fa70aaf500b29cd9cdece673387a2"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-TenantModule-7315c7432d94bcb2f828560d0c8328f211d704be7375918d3b00b267f5b0ae9fd19372f36b786cdf7e61a32e1c2d05b2d96fa70aaf500b29cd9cdece673387a2"' :
                                            'id="xs-controllers-links-module-TenantModule-7315c7432d94bcb2f828560d0c8328f211d704be7375918d3b00b267f5b0ae9fd19372f36b786cdf7e61a32e1c2d05b2d96fa70aaf500b29cd9cdece673387a2"' }>
                                            <li class="link">
                                                <a href="controllers/TenantController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TenantController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-TenantModule-7315c7432d94bcb2f828560d0c8328f211d704be7375918d3b00b267f5b0ae9fd19372f36b786cdf7e61a32e1c2d05b2d96fa70aaf500b29cd9cdece673387a2"' : 'data-bs-target="#xs-injectables-links-module-TenantModule-7315c7432d94bcb2f828560d0c8328f211d704be7375918d3b00b267f5b0ae9fd19372f36b786cdf7e61a32e1c2d05b2d96fa70aaf500b29cd9cdece673387a2"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-TenantModule-7315c7432d94bcb2f828560d0c8328f211d704be7375918d3b00b267f5b0ae9fd19372f36b786cdf7e61a32e1c2d05b2d96fa70aaf500b29cd9cdece673387a2"' :
                                        'id="xs-injectables-links-module-TenantModule-7315c7432d94bcb2f828560d0c8328f211d704be7375918d3b00b267f5b0ae9fd19372f36b786cdf7e61a32e1c2d05b2d96fa70aaf500b29cd9cdece673387a2"' }>
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
                                            'data-bs-target="#controllers-links-module-TrustListModule-90e8fcf0281d64b5198a68edd30031d452df9f2a52f2647c686458eede056d18ebdb0de53c14ce228ca80ea064857705cf573e03f5f426bdbf11e8e3f34bf96d"' : 'data-bs-target="#xs-controllers-links-module-TrustListModule-90e8fcf0281d64b5198a68edd30031d452df9f2a52f2647c686458eede056d18ebdb0de53c14ce228ca80ea064857705cf573e03f5f426bdbf11e8e3f34bf96d"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-TrustListModule-90e8fcf0281d64b5198a68edd30031d452df9f2a52f2647c686458eede056d18ebdb0de53c14ce228ca80ea064857705cf573e03f5f426bdbf11e8e3f34bf96d"' :
                                            'id="xs-controllers-links-module-TrustListModule-90e8fcf0281d64b5198a68edd30031d452df9f2a52f2647c686458eede056d18ebdb0de53c14ce228ca80ea064857705cf573e03f5f426bdbf11e8e3f34bf96d"' }>
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
                                        'data-bs-target="#injectables-links-module-TrustListModule-90e8fcf0281d64b5198a68edd30031d452df9f2a52f2647c686458eede056d18ebdb0de53c14ce228ca80ea064857705cf573e03f5f426bdbf11e8e3f34bf96d"' : 'data-bs-target="#xs-injectables-links-module-TrustListModule-90e8fcf0281d64b5198a68edd30031d452df9f2a52f2647c686458eede056d18ebdb0de53c14ce228ca80ea064857705cf573e03f5f426bdbf11e8e3f34bf96d"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-TrustListModule-90e8fcf0281d64b5198a68edd30031d452df9f2a52f2647c686458eede056d18ebdb0de53c14ce228ca80ea064857705cf573e03f5f426bdbf11e8e3f34bf96d"' :
                                        'id="xs-injectables-links-module-TrustListModule-90e8fcf0281d64b5198a68edd30031d452df9f2a52f2647c686458eede056d18ebdb0de53c14ce228ca80ea064857705cf573e03f5f426bdbf11e8e3f34bf96d"' }>
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
                                            'data-bs-target="#controllers-links-module-TrustModule-5d5ec7abf34c0e315cbbe34b10e31103e96522a47cae2f31c605c92c275529a233b8dd93761ea06bf2c7a612218df5e1d94c2fe8c19a469c96d332c400ca7bfc"' : 'data-bs-target="#xs-controllers-links-module-TrustModule-5d5ec7abf34c0e315cbbe34b10e31103e96522a47cae2f31c605c92c275529a233b8dd93761ea06bf2c7a612218df5e1d94c2fe8c19a469c96d332c400ca7bfc"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-TrustModule-5d5ec7abf34c0e315cbbe34b10e31103e96522a47cae2f31c605c92c275529a233b8dd93761ea06bf2c7a612218df5e1d94c2fe8c19a469c96d332c400ca7bfc"' :
                                            'id="xs-controllers-links-module-TrustModule-5d5ec7abf34c0e315cbbe34b10e31103e96522a47cae2f31c605c92c275529a233b8dd93761ea06bf2c7a612218df5e1d94c2fe8c19a469c96d332c400ca7bfc"' }>
                                            <li class="link">
                                                <a href="controllers/CacheController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CacheController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-TrustModule-5d5ec7abf34c0e315cbbe34b10e31103e96522a47cae2f31c605c92c275529a233b8dd93761ea06bf2c7a612218df5e1d94c2fe8c19a469c96d332c400ca7bfc"' : 'data-bs-target="#xs-injectables-links-module-TrustModule-5d5ec7abf34c0e315cbbe34b10e31103e96522a47cae2f31c605c92c275529a233b8dd93761ea06bf2c7a612218df5e1d94c2fe8c19a469c96d332c400ca7bfc"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-TrustModule-5d5ec7abf34c0e315cbbe34b10e31103e96522a47cae2f31c605c92c275529a233b8dd93761ea06bf2c7a612218df5e1d94c2fe8c19a469c96d332c400ca7bfc"' :
                                        'id="xs-injectables-links-module-TrustModule-5d5ec7abf34c0e315cbbe34b10e31103e96522a47cae2f31c605c92c275529a233b8dd93761ea06bf2c7a612218df5e1d94c2fe8c19a469c96d332c400ca7bfc"' }>
                                        <li class="link">
                                            <a href="injectables/FederationTrustService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >FederationTrustService</a>
                                        </li>
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
                                            'data-bs-target="#controllers-links-module-VerifierModule-66885ae36ab7916a56f33728922c0bd2cfe99c90358864f32018f685cc98e53abeec56c962daf4fd01083015ff829e6ff9e4403a2c9cdbc9221acb91cf2aed1b"' : 'data-bs-target="#xs-controllers-links-module-VerifierModule-66885ae36ab7916a56f33728922c0bd2cfe99c90358864f32018f685cc98e53abeec56c962daf4fd01083015ff829e6ff9e4403a2c9cdbc9221acb91cf2aed1b"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-VerifierModule-66885ae36ab7916a56f33728922c0bd2cfe99c90358864f32018f685cc98e53abeec56c962daf4fd01083015ff829e6ff9e4403a2c9cdbc9221acb91cf2aed1b"' :
                                            'id="xs-controllers-links-module-VerifierModule-66885ae36ab7916a56f33728922c0bd2cfe99c90358864f32018f685cc98e53abeec56c962daf4fd01083015ff829e6ff9e4403a2c9cdbc9221acb91cf2aed1b"' }>
                                            <li class="link">
                                                <a href="controllers/VerifierOfferController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >VerifierOfferController</a>
                                            </li>
                                        </ul>
                                    </li>
                            </li>
                            <li class="link">
                                <a href="modules/WebhookEndpointModule.html" data-type="entity-link" >WebhookEndpointModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-WebhookEndpointModule-9f7a6baa4b361723e23a98580b15a381b0187dc1fb061b07a6584c72f7c3879e0f0fb112a53c2ea32a6240720e9213e4f0347d4532b4ecb71e40f46d6b989bca"' : 'data-bs-target="#xs-controllers-links-module-WebhookEndpointModule-9f7a6baa4b361723e23a98580b15a381b0187dc1fb061b07a6584c72f7c3879e0f0fb112a53c2ea32a6240720e9213e4f0347d4532b4ecb71e40f46d6b989bca"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-WebhookEndpointModule-9f7a6baa4b361723e23a98580b15a381b0187dc1fb061b07a6584c72f7c3879e0f0fb112a53c2ea32a6240720e9213e4f0347d4532b4ecb71e40f46d6b989bca"' :
                                            'id="xs-controllers-links-module-WebhookEndpointModule-9f7a6baa4b361723e23a98580b15a381b0187dc1fb061b07a6584c72f7c3879e0f0fb112a53c2ea32a6240720e9213e4f0347d4532b4ecb71e40f46d6b989bca"' }>
                                            <li class="link">
                                                <a href="controllers/WebhookEndpointController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >WebhookEndpointController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-WebhookEndpointModule-9f7a6baa4b361723e23a98580b15a381b0187dc1fb061b07a6584c72f7c3879e0f0fb112a53c2ea32a6240720e9213e4f0347d4532b4ecb71e40f46d6b989bca"' : 'data-bs-target="#xs-injectables-links-module-WebhookEndpointModule-9f7a6baa4b361723e23a98580b15a381b0187dc1fb061b07a6584c72f7c3879e0f0fb112a53c2ea32a6240720e9213e4f0347d4532b4ecb71e40f46d6b989bca"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-WebhookEndpointModule-9f7a6baa4b361723e23a98580b15a381b0187dc1fb061b07a6584c72f7c3879e0f0fb112a53c2ea32a6240720e9213e4f0347d4532b4ecb71e40f46d6b989bca"' :
                                        'id="xs-injectables-links-module-WebhookEndpointModule-9f7a6baa4b361723e23a98580b15a381b0187dc1fb061b07a6584c72f7c3879e0f0fb112a53c2ea32a6240720e9213e4f0347d4532b4ecb71e40f46d6b989bca"' }>
                                        <li class="link">
                                            <a href="injectables/WebhookEndpointService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >WebhookEndpointService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/WebhookModule.html" data-type="entity-link" >WebhookModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-WebhookModule-7c02ad7ae9aa1733c7f00609229b8386299b6d8037033fb4c3c58ebbaa896b149afd20953a80ac1e065525597b93ab48b33488af4bc8359f03983df9cd9c6399"' : 'data-bs-target="#xs-injectables-links-module-WebhookModule-7c02ad7ae9aa1733c7f00609229b8386299b6d8037033fb4c3c58ebbaa896b149afd20953a80ac1e065525597b93ab48b33488af4bc8359f03983df9cd9c6399"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-WebhookModule-7c02ad7ae9aa1733c7f00609229b8386299b6d8037033fb4c3c58ebbaa896b149afd20953a80ac1e065525597b93ab48b33488af4bc8359f03983df9cd9c6399"' :
                                        'id="xs-injectables-links-module-WebhookModule-7c02ad7ae9aa1733c7f00609229b8386299b6d8037033fb4c3c58ebbaa896b149afd20953a80ac1e065525597b93ab48b33488af4bc8359f03983df9cd9c6399"' }>
                                        <li class="link">
                                            <a href="injectables/OutboundUrlPolicyService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >OutboundUrlPolicyService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/WebhookService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >WebhookService</a>
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
                                    <a href="entities/ConfigResourceMetadataEntity.html" data-type="entity-link" >ConfigResourceMetadataEntity</a>
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
                                <a href="classes/AddAuthorizationServersToIssuanceConfig1766000000000.html" data-type="entity-link" >AddAuthorizationServersToIssuanceConfig1766000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddConfigResourceMetadata1777000000000.html" data-type="entity-link" >AddConfigResourceMetadata1777000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddCredentialRequestEncryptionToIssuanceConfig1753100000000.html" data-type="entity-link" >AddCredentialRequestEncryptionToIssuanceConfig1753100000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddCredentialResponseEncryptionToIssuanceConfig1753000000000.html" data-type="entity-link" >AddCredentialResponseEncryptionToIssuanceConfig1753000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddCwtCacheToStatusList1771000000000.html" data-type="entity-link" >AddCwtCacheToStatusList1771000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddDcApiProtocolToSession1770000000000.html" data-type="entity-link" >AddDcApiProtocolToSession1770000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddDirectPostSecurityFields1751000000000.html" data-type="entity-link" >AddDirectPostSecurityFields1751000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddExternalKeyId1742000000000.html" data-type="entity-link" >AddExternalKeyId1742000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddFederationToIssuanceConfig1763000000000.html" data-type="entity-link" >AddFederationToIssuanceConfig1763000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddIssuerRegistrationCertificateToIssuanceConfig1767000000000.html" data-type="entity-link" >AddIssuerRegistrationCertificateToIssuanceConfig1767000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddKeyRotation1744000000000.html" data-type="entity-link" >AddKeyRotation1744000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddKeyUsageEntity1743000000000.html" data-type="entity-link" >AddKeyUsageEntity1743000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddKmsExternalKeyIdCheck1764000000000.html" data-type="entity-link" >AddKmsExternalKeyIdCheck1764000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddKmsProvider1740500000000.html" data-type="entity-link" >AddKmsProvider1740500000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddMissingSessionColumns1778000000000.html" data-type="entity-link" >AddMissingSessionColumns1778000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddNotificationEndpointEnabledToIssuanceConfig1775000000000.html" data-type="entity-link" >AddNotificationEndpointEnabledToIssuanceConfig1775000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddPreferredAuthServerToIssuanceConfig1741500000000.html" data-type="entity-link" >AddPreferredAuthServerToIssuanceConfig1741500000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddPresentationStatusCheckMode1773000000000.html" data-type="entity-link" >AddPresentationStatusCheckMode1773000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddReaderAuthToPresentationConfig1774000000000.html" data-type="entity-link" >AddReaderAuthToPresentationConfig1774000000000</a>
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
                                <a href="classes/AddRootExternalKeyIdToKeyChain1774000000000.html" data-type="entity-link" >AddRootExternalKeyIdToKeyChain1774000000000</a>
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
                                <a href="classes/AddStatusListVersionAndUniqueConstraint1776000000000.html" data-type="entity-link" >AddStatusListVersionAndUniqueConstraint1776000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddTenantActionLog1762000000000.html" data-type="entity-link" >AddTenantActionLog1762000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddTxCodeAttemptTracking1757000000000.html" data-type="entity-link" >AddTxCodeAttemptTracking1757000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddVerifierSkewSeconds1772000000000.html" data-type="entity-link" >AddVerifierSkewSeconds1772000000000</a>
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
                                <a href="classes/AuthorizeQueries.html" data-type="entity-link" >AuthorizeQueries</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthResponse.html" data-type="entity-link" >AuthResponse</a>
                            </li>
                            <li class="link">
                                <a href="classes/AwsKmsAdapter.html" data-type="entity-link" >AwsKmsAdapter</a>
                            </li>
                            <li class="link">
                                <a href="classes/BaselineMigration1740000000000.html" data-type="entity-link" >BaselineMigration1740000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/BuiltInAuthorizationServerConfig.html" data-type="entity-link" >BuiltInAuthorizationServerConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/CacheStatsResponseDto.html" data-type="entity-link" >CacheStatsResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CertificateInfoDto.html" data-type="entity-link" >CertificateInfoDto</a>
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
                                <a href="classes/ChainedAsVpConfig.html" data-type="entity-link" >ChainedAsVpConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChainedAuthorizationServerConfig.html" data-type="entity-link" >ChainedAuthorizationServerConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/ClaimFieldDefinitionDto.html" data-type="entity-link" >ClaimFieldDefinitionDto</a>
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
                                <a href="classes/ConfigResourceMetadataEntity.html" data-type="entity-link" >ConfigResourceMetadataEntity</a>
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
                                <a href="classes/CredentialConfig.html" data-type="entity-link" >CredentialConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialConfigCreate.html" data-type="entity-link" >CredentialConfigCreate</a>
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
                                <a href="classes/CredentialQueryDcSdJwt.html" data-type="entity-link" >CredentialQueryDcSdJwt</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialQueryMsoMdoc.html" data-type="entity-link" >CredentialQueryMsoMdoc</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialRequestException.html" data-type="entity-link" >CredentialRequestException</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialReusePolicy.html" data-type="entity-link" >CredentialReusePolicy</a>
                            </li>
                            <li class="link">
                                <a href="classes/CredentialSetQuery.html" data-type="entity-link" >CredentialSetQuery</a>
                            </li>
                            <li class="link">
                                <a href="classes/CscKmsAdapter.html" data-type="entity-link" >CscKmsAdapter</a>
                            </li>
                            <li class="link">
                                <a href="classes/DbKmsAdapter.html" data-type="entity-link" >DbKmsAdapter</a>
                            </li>
                            <li class="link">
                                <a href="classes/DCQL.html" data-type="entity-link" >DCQL</a>
                            </li>
                            <li class="link">
                                <a href="classes/DcSdJwtCredentialQueryMeta.html" data-type="entity-link" >DcSdJwtCredentialQueryMeta</a>
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
                                <a href="classes/ExternalAuthorizationServerConfig.html" data-type="entity-link" >ExternalAuthorizationServerConfig</a>
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
                                <a href="classes/FederationConfig.html" data-type="entity-link" >FederationConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/FederationTrustAnchorConfig.html" data-type="entity-link" >FederationTrustAnchorConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/FieldDisplayDto.html" data-type="entity-link" >FieldDisplayDto</a>
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
                                <a href="classes/HttpKmsAdapter.html" data-type="entity-link" >HttpKmsAdapter</a>
                            </li>
                            <li class="link">
                                <a href="classes/IaeActionOpenid4vpPresentation.html" data-type="entity-link" >IaeActionOpenid4vpPresentation</a>
                            </li>
                            <li class="link">
                                <a href="classes/IaeActionRedirectToWeb.html" data-type="entity-link" >IaeActionRedirectToWeb</a>
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
                                <a href="classes/IssuerOfferEntryDto.html" data-type="entity-link" >IssuerOfferEntryDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/IssuerProvidedAttestation.html" data-type="entity-link" >IssuerProvidedAttestation</a>
                            </li>
                            <li class="link">
                                <a href="classes/IssuerRegistrationCertificateCache.html" data-type="entity-link" >IssuerRegistrationCertificateCache</a>
                            </li>
                            <li class="link">
                                <a href="classes/IssuerRegistrationCertificateConfig.html" data-type="entity-link" >IssuerRegistrationCertificateConfig</a>
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
                                <a href="classes/KeyChainIdResponseDto.html" data-type="entity-link" >KeyChainIdResponseDto</a>
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
                                <a href="classes/KeyResponseDto.html" data-type="entity-link" >KeyResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KmsConfigDto.html" data-type="entity-link" >KmsConfigDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/KmsCryptoProvider.html" data-type="entity-link" >KmsCryptoProvider</a>
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
                                <a href="classes/KmsTenantConfigResponseDto.html" data-type="entity-link" >KmsTenantConfigResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/LocalFileStorage.html" data-type="entity-link" >LocalFileStorage</a>
                            </li>
                            <li class="link">
                                <a href="classes/ManagedAuthorizationServerConfig.html" data-type="entity-link" >ManagedAuthorizationServerConfig</a>
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
                                <a href="classes/MsoMdocClaimsQuery.html" data-type="entity-link" >MsoMdocClaimsQuery</a>
                            </li>
                            <li class="link">
                                <a href="classes/MsoMdocCredentialQueryMeta.html" data-type="entity-link" >MsoMdocCredentialQueryMeta</a>
                            </li>
                            <li class="link">
                                <a href="classes/NoneTrustPolicy.html" data-type="entity-link" >NoneTrustPolicy</a>
                            </li>
                            <li class="link">
                                <a href="classes/NotificationRequestDto.html" data-type="entity-link" >NotificationRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/OAuthTokenErrorResponseDto.html" data-type="entity-link" >OAuthTokenErrorResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/OfferRequestDto.html" data-type="entity-link" >OfferRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/OfferResponse.html" data-type="entity-link" >OfferResponse</a>
                            </li>
                            <li class="link">
                                <a href="classes/Oid4VpAuthorizationServerConfig.html" data-type="entity-link" >Oid4VpAuthorizationServerConfig</a>
                            </li>
                            <li class="link">
                                <a href="classes/Openid4vpRequestDto.html" data-type="entity-link" >Openid4vpRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/PaginatedSessionResponseDto.html" data-type="entity-link" >PaginatedSessionResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ParResponseDto.html" data-type="entity-link" >ParResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/Pkcs11KmsAdapter.html" data-type="entity-link" >Pkcs11KmsAdapter</a>
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
                                <a href="classes/ProviderHealthResponseDto.html" data-type="entity-link" >ProviderHealthResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/PublicJwkCache.html" data-type="entity-link" >PublicJwkCache</a>
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
                                <a href="classes/RemovePreferredAuthServerFromIssuanceConfig1769000000000.html" data-type="entity-link" >RemovePreferredAuthServerFromIssuanceConfig1769000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/RemoveRefreshTokenFromIssuanceConfig1768000000000.html" data-type="entity-link" >RemoveRefreshTokenFromIssuanceConfig1768000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/RenameKeyChainActiveKeyToActiveJwk1765000000000.html" data-type="entity-link" >RenameKeyChainActiveKeyToActiveJwk1765000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/RenameSigningToAttestation1745000000000.html" data-type="entity-link" >RenameSigningToAttestation1745000000000</a>
                            </li>
                            <li class="link">
                                <a href="classes/ResolvedSchemaMetadataReferenceDto.html" data-type="entity-link" >ResolvedSchemaMetadataReferenceDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ResolvedSchemaMetadataResponseDto.html" data-type="entity-link" >ResolvedSchemaMetadataResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ResolvedSchemaMetadataSchemaDto.html" data-type="entity-link" >ResolvedSchemaMetadataSchemaDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ResolvedSchemaMetadataSchemaUriDto.html" data-type="entity-link" >ResolvedSchemaMetadataSchemaUriDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ResolvedSchemaMetadataTrustedAuthorityDto.html" data-type="entity-link" >ResolvedSchemaMetadataTrustedAuthorityDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ResolveIssuerMetadataDto.html" data-type="entity-link" >ResolveIssuerMetadataDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ResolveSchemaMetadataDto.html" data-type="entity-link" >ResolveSchemaMetadataDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ResolveSchemaMetadataJwtDto.html" data-type="entity-link" >ResolveSchemaMetadataJwtDto</a>
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
                                <a href="classes/SchemaUriEntry.html" data-type="entity-link" >SchemaUriEntry</a>
                            </li>
                            <li class="link">
                                <a href="classes/SessionLogEntryResponseDto.html" data-type="entity-link" >SessionLogEntryResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/SessionQueryDto.html" data-type="entity-link" >SessionQueryDto</a>
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
                                <a href="classes/StatusListCacheStatsDto.html" data-type="entity-link" >StatusListCacheStatsDto</a>
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
                                <a href="classes/StatusMapping.html" data-type="entity-link" >StatusMapping</a>
                            </li>
                            <li class="link">
                                <a href="classes/StatusUpdateDto.html" data-type="entity-link" >StatusUpdateDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/StoredObjectResponseDto.html" data-type="entity-link" >StoredObjectResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/TenantClientCredentialsDto.html" data-type="entity-link" >TenantClientCredentialsDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/TenantCreateResponseDto.html" data-type="entity-link" >TenantCreateResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/TenantResponseDto.html" data-type="entity-link" >TenantResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/TokenErrorException.html" data-type="entity-link" >TokenErrorException</a>
                            </li>
                            <li class="link">
                                <a href="classes/TokenResponse.html" data-type="entity-link" >TokenResponse</a>
                            </li>
                            <li class="link">
                                <a href="classes/TolerantIssuerAlternativeNameExtension.html" data-type="entity-link" >TolerantIssuerAlternativeNameExtension</a>
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
                                <a href="classes/TrustedAuthorityQueryEtsiTl.html" data-type="entity-link" >TrustedAuthorityQueryEtsiTl</a>
                            </li>
                            <li class="link">
                                <a href="classes/TrustedAuthorityQueryOpenIdFederation.html" data-type="entity-link" >TrustedAuthorityQueryOpenIdFederation</a>
                            </li>
                            <li class="link">
                                <a href="classes/TrustListCacheStatsDto.html" data-type="entity-link" >TrustListCacheStatsDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/TrustListCreateDto.html" data-type="entity-link" >TrustListCreateDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/TrustListEntityInfo.html" data-type="entity-link" >TrustListEntityInfo</a>
                            </li>
                            <li class="link">
                                <a href="classes/TrustListRef.html" data-type="entity-link" >TrustListRef</a>
                            </li>
                            <li class="link">
                                <a href="classes/TrustListUnavailableError.html" data-type="entity-link" >TrustListUnavailableError</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateAttributeProviderDto.html" data-type="entity-link" >UpdateAttributeProviderDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateClientDto.html" data-type="entity-link" >UpdateClientDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateIssuanceDto.html" data-type="entity-link" >UpdateIssuanceDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateIssuerOfferDto.html" data-type="entity-link" >UpdateIssuerOfferDto</a>
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
                                <a href="classes/VaultKmsAdapter.html" data-type="entity-link" >VaultKmsAdapter</a>
                            </li>
                            <li class="link">
                                <a href="classes/VCT.html" data-type="entity-link" >VCT</a>
                            </li>
                            <li class="link">
                                <a href="classes/VersionResponseDto.html" data-type="entity-link" >VersionResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/VocabularyEntryDto.html" data-type="entity-link" >VocabularyEntryDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/WalletProviderTrustListRefDto.html" data-type="entity-link" >WalletProviderTrustListRefDto</a>
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
                                    <a href="injectables/CertificateBuilderService.html" data-type="entity-link" >CertificateBuilderService</a>
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
                                    <a href="injectables/KeyChainImportService.html" data-type="entity-link" >KeyChainImportService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/KeyChainService.html" data-type="entity-link" >KeyChainService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/KeyChainSigningService.html" data-type="entity-link" >KeyChainSigningService</a>
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
                                    <a href="injectables/KmsConfigService.html" data-type="entity-link" >KmsConfigService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/KmsProviderRegistry.html" data-type="entity-link" >KmsProviderRegistry</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/KmsTenantConfigService.html" data-type="entity-link" >KmsTenantConfigService</a>
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
                                <a href="interfaces/AttestationProofTrustValidationDeps.html" data-type="entity-link" >AttestationProofTrustValidationDeps</a>
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
                                <a href="interfaces/AuthorizationServerMetadataBuildOptions.html" data-type="entity-link" >AuthorizationServerMetadataBuildOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/AwsKmsAdapterConfig.html" data-type="entity-link" >AwsKmsAdapterConfig</a>
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
                                <a href="interfaces/ClaimDisplayInfo.html" data-type="entity-link" >ClaimDisplayInfo</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ClaimDisplayInput.html" data-type="entity-link" >ClaimDisplayInput</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ClaimFieldDefinition.html" data-type="entity-link" >ClaimFieldDefinition</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ClaimMetadata.html" data-type="entity-link" >ClaimMetadata</a>
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
                                <a href="interfaces/ConfigBundle.html" data-type="entity-link" >ConfigBundle</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigBundleAsset.html" data-type="entity-link" >ConfigBundleAsset</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigBundleManifest.html" data-type="entity-link" >ConfigBundleManifest</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigBundleRequirement.html" data-type="entity-link" >ConfigBundleRequirement</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigBundleResource.html" data-type="entity-link" >ConfigBundleResource</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigDocument.html" data-type="entity-link" >ConfigDocument&lt;T &#x3D; Record&lt;string, unknown&gt;&gt;</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigDocumentMetadata.html" data-type="entity-link" >ConfigDocumentMetadata</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigImportPlan.html" data-type="entity-link" >ConfigImportPlan</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigImportPlanItem.html" data-type="entity-link" >ConfigImportPlanItem</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigMigration.html" data-type="entity-link" >ConfigMigration</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigMigrationIssue.html" data-type="entity-link" >ConfigMigrationIssue</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigMigrationResult.html" data-type="entity-link" >ConfigMigrationResult&lt;T &#x3D; Record&lt;string, unknown&gt;&gt;</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigResourceDefinition.html" data-type="entity-link" >ConfigResourceDefinition</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ConfigResourceRouteMatch.html" data-type="entity-link" >ConfigResourceRouteMatch</a>
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
                                <a href="interfaces/CscAuthorizeAuthData.html" data-type="entity-link" >CscAuthorizeAuthData</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CscKmsAdapterConfig.html" data-type="entity-link" >CscKmsAdapterConfig</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/EncryptionKeyProvider.html" data-type="entity-link" >EncryptionKeyProvider</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ExternalKeySource.html" data-type="entity-link" >ExternalKeySource</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/FieldDisplay.html" data-type="entity-link" >FieldDisplay</a>
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
                                <a href="interfaces/HttpKmsAdapterConfig.html" data-type="entity-link" >HttpKmsAdapterConfig</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ImportOptions.html" data-type="entity-link" >ImportOptions&lt;T extends object&gt;</a>
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
                                <a href="interfaces/Iso18013Offer.html" data-type="entity-link" >Iso18013Offer</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IssuerInfo.html" data-type="entity-link" >IssuerInfo</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/JsonSchema.html" data-type="entity-link" >JsonSchema</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/JwkWithOptionalKid.html" data-type="entity-link" >JwkWithOptionalKid</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/KmsAdapter.html" data-type="entity-link" >KmsAdapter</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/KmsAdapterCapabilities.html" data-type="entity-link" >KmsAdapterCapabilities</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/KmsHealthResult.html" data-type="entity-link" >KmsHealthResult</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/KmsKeyMaterial.html" data-type="entity-link" >KmsKeyMaterial</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/KmsKeyRef.html" data-type="entity-link" >KmsKeyRef</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/KmsSigningKeyMarker.html" data-type="entity-link" >KmsSigningKeyMarker</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/MdocErrorDetails.html" data-type="entity-link" >MdocErrorDetails</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/MdocIssueOptions.html" data-type="entity-link" >MdocIssueOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/OfferRequestData.html" data-type="entity-link" >OfferRequestData</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/OidcDiscoveryDocument.html" data-type="entity-link" >OidcDiscoveryDocument</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/OidcDiscoveryDto.html" data-type="entity-link" >OidcDiscoveryDto</a>
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
                                <a href="interfaces/ParsedCredentialProofs.html" data-type="entity-link" >ParsedCredentialProofs</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ParsedInteractiveAuthorizationRequest.html" data-type="entity-link" >ParsedInteractiveAuthorizationRequest</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Pkcs11AdapterConfig.html" data-type="entity-link" >Pkcs11AdapterConfig</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Pkcs11Attribute.html" data-type="entity-link" >Pkcs11Attribute</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Pkcs11Constants.html" data-type="entity-link" >Pkcs11Constants</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Pkcs11Instance.html" data-type="entity-link" >Pkcs11Instance</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Pkcs11Module.html" data-type="entity-link" >Pkcs11Module</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/PortableImportRunner.html" data-type="entity-link" >PortableImportRunner</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/PresentationRequestData.html" data-type="entity-link" >PresentationRequestData</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/RecordAuditLogInput.html" data-type="entity-link" >RecordAuditLogInput</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/RefreshTokenIssuanceConfig.html" data-type="entity-link" >RefreshTokenIssuanceConfig</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/RegisteredImporter.html" data-type="entity-link" >RegisteredImporter</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/RegistrationCertCache.html" data-type="entity-link" >RegistrationCertCache</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/SdJwtVcIssueOptions.html" data-type="entity-link" >SdJwtVcIssueOptions</a>
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
                                <a href="interfaces/TenantSetupFn.html" data-type="entity-link" >TenantSetupFn</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/TlsOptions.html" data-type="entity-link" >TlsOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/TokenPayload.html" data-type="entity-link" >TokenPayload</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ValidationIssue.html" data-type="entity-link" >ValidationIssue</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/VaultAdapterConfig.html" data-type="entity-link" >VaultAdapterConfig</a>
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
