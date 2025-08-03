export interface ClassDefinition {
  id: number;
  name: string;
  color: string;
  key: string;
}

export interface YoloProject {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  directoryStructure: {
    images: string;
    labels: string;
    classes: string;
  };
  classNames: string[];
  classDefinitions?: ClassDefinition[];
}