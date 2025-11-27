/**
 * Type declarations for Accord Project packages
 * Updated for concerto-core v3.24.0 (AI-first approach - no cicero-core)
 */

declare module "@accordproject/concerto-core" {
  export class ModelManager {
    constructor(options?: {
      strict?: boolean;
      regExp?: object;
      metamodelValidation?: boolean;
      addMetamodel?: boolean;
      enableMapType?: boolean;
      importAliasing?: boolean;
      decoratorValidation?: {
        missingDecorator?: string;
        invalidDecorator?: string;
      };
    });

    addCTOModel(
      cto: string,
      fileName?: string,
      disableValidation?: boolean
    ): ModelFile;
    addModelFile(
      modelFile: string,
      fileName?: string,
      disableValidation?: boolean
    ): void;
    addModelFiles(
      modelFiles: string[],
      fileNames?: string[],
      disableValidation?: boolean
    ): void;
    validateModelFile(content: string, fileName?: string): void;
    getModels(): Array<{ content: string; name: string }>;
    getModelFile(namespace: string): ModelFile | null;
    getNamespaces(): string[];
    clearModelFiles(): void;
  }

  export class ModelFile {
    getNamespace(): string;
    getName(): string;
    getAllDeclarations(): ClassDeclaration[];
    getDefinitions(): string;
  }

  export class ClassDeclaration {
    getName(): string;
    getNamespace(): string;
    getFullyQualifiedName(): string;
    getProperties(): Property[];
    isAbstract(): boolean;
    isAsset(): boolean;
    isConcept(): boolean;
    isEnum(): boolean;
    isEvent(): boolean;
    isParticipant(): boolean;
    isTransaction(): boolean;
  }

  export class Property {
    getName(): string;
    getType(): string;
    isOptional(): boolean;
    isArray(): boolean;
    getDefaultValue(): unknown;
  }

  export class Factory {
    constructor(modelManager: ModelManager);
    newResource(namespace: string, type: string, id?: string): Resource;
    newConcept(namespace: string, type: string, id?: string): Resource;
    newTransaction(namespace: string, type: string, id?: string): Resource;
  }

  export class Serializer {
    constructor(factory: Factory, modelManager: ModelManager, options?: object);
    toJSON(resource: Resource, options?: object): Record<string, unknown>;
    fromJSON(json: Record<string, unknown>, options?: object): Resource;
  }

  export class Resource {
    getType(): string;
    getNamespace(): string;
    getFullyQualifiedType(): string;
    getIdentifier(): string;
    setIdentifier(id: string): void;
    toJSON(): Record<string, unknown>;
  }

  export class Introspector {
    constructor(modelManager: ModelManager);
    getClassDeclarations(): ClassDeclaration[];
    getClassDeclaration(fqn: string): ClassDeclaration;
  }

  export class ModelLoader {
    static loadModelManager(
      ctoFiles: string[],
      options?: object
    ): Promise<ModelManager>;
    static loadModelManagerFromModelFiles(
      modelFiles: object[],
      fileNames?: string[],
      options?: object
    ): Promise<ModelManager>;
  }

  export class Concerto {
    constructor(modelManager: ModelManager);
    validate(obj: object): void;
    getTypeDeclaration(obj: object): ClassDeclaration;
    isIdentifiable(obj: object): boolean;
    isRelationship(obj: object): boolean;
    getIdentifier(obj: object): string;
    setIdentifier(obj: object, id: string): void;
    getFullyQualifiedIdentifier(obj: object): string;
  }
}
