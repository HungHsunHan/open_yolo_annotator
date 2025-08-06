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
  assignedUsers: string[]; // Array of user IDs who have access to this project
  directoryStructure: {
    images: string;
    labels: string;
    classes: string;
  };
  classNames: string[];
  classDefinitions?: ClassDefinition[];
}